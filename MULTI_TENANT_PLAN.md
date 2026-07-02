# Multi-Tenant Migration Plan — PBB Customer Success Hub

**Status:** Planning only. No code or cloud resources created yet.
**Decision (locked):** Workspace/team tenancy · Supabase backend · phased build on a separate branch.
**Goal:** Turn the single-browser `localStorage` app into a real multi-user SaaS where each account owns a workspace, can invite teammates, and every workspace's data is fully isolated from every other.

---

## 1. Architecture at a glance

| Layer | Today | After migration |
|-------|-------|-----------------|
| Data store | Browser `localStorage` | Supabase Postgres (cloud) |
| Identity | None (anonymous) | Supabase Auth (email/pw, magic link, optional Google SSO) |
| Isolation | N/A (one browser = one dataset) | Row Level Security (RLS) keyed on workspace membership |
| Sharing | None | Invite teammates into a shared workspace |
| IDs | `Date.now().toString()` | DB-generated UUIDs |

**Isolation model:** a user signs up → automatically gets their own **workspace** → all their clients/projects/tasks/team/resources belong to that workspace. They can later invite other people, who log in with their own accounts but share that workspace. Postgres RLS guarantees a user can only ever read/write rows in workspaces they belong to — enforced at the database, not in React.

---

## 2. Database schema

Seven tables. Every data table carries a `workspace_id` — that column is the whole basis of isolation.

### `workspaces`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | `gen_random_uuid()` |
| name | text | e.g. "Muniz Consulting Group" |
| owner_id | uuid | → `auth.users.id` |
| created_at | timestamptz | default `now()` |

### `workspace_members` (maps login users ↔ workspaces; enables collaboration + invites)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid | → `workspaces.id` |
| user_id | uuid | → `auth.users.id` |
| role | text | `owner` \| `admin` \| `member` |
| created_at | timestamptz | |

### `clients`
`id, workspace_id, name, company, email, phone, assigned_to (→ team_members.id), population_size, year_end_date, value_proposition, problem_issue, goal_metric, expected_deliverables, created_at`

### `projects`
`id, workspace_id, name, client_id (→ clients.id), status, start_date, end_date, description, use_pbb_template, created_at`

### `tasks`
`id, workspace_id, project_id (→ projects.id, nullable), title, description (Notes), assigned_to (→ team_members.id), status, priority, start_date, due_date, subtasks (jsonb), phase, phase_name, section, section_name, sort_order, created_at`

- **Subtasks:** store as a `jsonb` array on the task (matches the current `[{id,title,done}]` shape). Simplest and preserves what we just built. *(Alternative: a separate `subtasks` table — only worth it if you later want to report/query across subtasks.)*

### `team_members` (the bridge between "labels" and "real users")
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid | → `workspaces.id` |
| name | text | |
| role | text | job role (CSM, Analyst…) |
| email | text | |
| user_id | uuid nullable | set once this person accepts an invite & logs in |

A team member is a "seat." It starts as just a name/email you manage; if you invite them and they accept, `user_id` links to their real login. This upgrades today's team-member concept without breaking assignment dropdowns.

### `resources` (links only, per existing design)
`id, workspace_id, title, url, description, date_added, created_at`
- Flattens today's `{ links: [...] }` object into one row per link.

---

## 3. Row Level Security (the isolation guarantee)

Enable RLS on every table. The core policy on each **data** table:

```sql
-- Example for clients (identical shape for projects, tasks, team_members, resources)
alter table clients enable row level security;

create policy "workspace members can read"
  on clients for select
  using ( workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));

create policy "workspace members can write"
  on clients for all
  using ( workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ))
  with check ( workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));
```

- `workspaces`: a user can see a workspace only if they're a member.
- `workspace_members`: a user can see membership rows for workspaces they belong to.
- Net effect: queries automatically return only the caller's workspace data — no `WHERE workspace_id = ...` needed in the app; RLS applies it.

**Auto-provision a workspace on signup** via a Postgres trigger:

```sql
create function handle_new_user() returns trigger as $$
declare ws_id uuid;
begin
  insert into workspaces (name, owner_id)
    values (coalesce(new.raw_user_meta_data->>'workspace_name', 'My Workspace'), new.id)
    returning id into ws_id;
  insert into workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

## 4. Application changes

The app is reasonably positioned because the `storage` wrapper is already async.

1. **Dependency:** add `@supabase/supabase-js`.
2. **Client:** `src/supabaseClient.js` reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (both are safe to expose in the browser; the service-role key must NEVER ship client-side).
3. **Auth gate:** a wrapper that renders Login/Signup until there's a session, then renders `ClientProjectManager`. Uses `supabase.auth.onAuthStateChange`.
4. **Workspace bootstrap:** on login, fetch the user's `workspace_members` row(s) and hold `currentWorkspaceId` in state (single workspace for v1; workspace-switcher later).
5. **Swap the storage layer:** replace the five `save*`/`load*` functions and the `storage` object with Supabase queries (`supabase.from('clients').select()/insert()/update()/delete()`). RLS scopes them automatically. **React components largely stay the same** — they still receive `clients`, `projects`, etc. as props.
6. **IDs → UUIDs:** drop `Date.now().toString()` for row ids (DB generates them). Subtask ids inside the `jsonb` array can stay client-generated.
7. **UX polish:** real loading states and error handling (the current app has none — this is the moment to add them).

---

## 5. Migrating existing data (optional, one-time)

An "Import my current data" button that reads the existing `localStorage` keys and inserts them into the freshly created workspace, remapping old string ids → new UUIDs while preserving relationships (`client_id`, `project_id`, `assigned_to`). Run once per browser that has data worth keeping.

---

## 6. Phased rollout (on a `feature/multi-tenant` branch)

| Phase | Scope | Size | App still works? |
|-------|-------|------|------------------|
| 0. Setup | Create Supabase project, enable Auth providers, add env vars, install client | S | Yes (unchanged) |
| 1. Schema + RLS | Create 7 tables, policies, new-user trigger; verify isolation with two test users via SQL | M | Yes (unchanged) |
| 2. Auth gate | Login/Signup UI, session handling, workspace bootstrap | M | Yes (login added) |
| 3. Storage swap | Replace `storage` wrapper with Supabase queries, entity by entity (clients → projects → tasks → team → resources) | **L** | Progressively |
| 4. Data import | One-time localStorage → DB importer | S | Yes |
| 5. Invites + roles | Invite teammates by email, accept flow, owner/admin/member permissions | M | Yes |
| 6. Polish | Loading/error states, optional realtime sync so teammates see live updates | M | Yes |

Phases 0–4 deliver a working single-user-per-workspace cloud app. Phase 5 unlocks true multi-person collaboration.

---

## 7. Cost & risk

- **Cost:** Supabase free tier (500 MB DB, 50k monthly active users) comfortably covers this. No cost to build or run initially.
- **Deployment:** Render needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set as environment variables.
- **Risks & mitigations:**
  - *RLS misconfiguration → data leak or lockout.* Mitigate: test every table with two separate test users before swapping the app over.
  - *ID type change ripples through code.* Mitigate: do it in Phase 3 entity-by-entity, not all at once.
  - *Secret handling.* Anon key is public-safe; never expose the service-role key in the client bundle.
  - *Offline.* localStorage worked offline; cloud requires connectivity. Optional: keep a localStorage cache layer.

---

## 8. Decisions to make before building

1. **Auth methods:** email/password only, add magic-link, and/or Google SSO?
2. **Roles/permissions:** just owner+member, or owner/admin/member with different rights?
3. **Invites:** email invitation vs. shareable join link?
4. **Subtasks storage:** `jsonb` column (recommended) vs. dedicated table?
5. **Keep localStorage** as an offline cache, or fully cloud-only?
6. **Data import:** do you have existing browser data worth migrating, or start fresh?

---

*Plan authored during Claude Code session. Nothing implemented yet — awaiting go-ahead to start Phase 0.*
