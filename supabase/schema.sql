-- Joan — multi-tenant schema (applied to Supabase project "joan" / xlarzxakwdzblitobbrt).
-- Source of truth is the live database; this file mirrors it for version control and
-- lets you recreate the schema from scratch. Applied via the Supabase MCP in two
-- migrations (init_multitenant_schema, harden_security_definer_functions); this is
-- the consolidated final state.

-- ============ Tables ============

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Workspace',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  role text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  assigned_to uuid references public.team_members(id) on delete set null,
  population_size text,
  year_end_date date,
  value_proposition text,
  problem_issue text,
  goal_metric text,
  expected_deliverables text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'planning',
  start_date date,
  end_date date,
  description text,
  use_pbb_template boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references public.team_members(id) on delete set null,
  status text not null default 'todo',
  priority text default 'medium',
  start_date date,
  due_date date,
  subtasks jsonb not null default '[]'::jsonb,
  phase text,
  phase_name text,
  section text,
  section_name text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  url text,
  description text,
  date_added timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  event_type text not null default 'time_off',
    -- availability: time_off | travel | sick | holiday
    -- client:       client_meeting | training | other
  member_id uuid references public.team_members(id) on delete set null,  -- who's out (availability)
  client_id uuid references public.clients(id) on delete set null,       -- optional (client events)
  start_date date not null,
  end_date date,               -- null = single-day
  all_day boolean not null default true,
  start_time time,             -- optional; shown as a label when all_day = false
  end_time time,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index calendar_events_ws_start_idx on public.calendar_events (workspace_id, start_date);

-- ============ Private helpers (not exposed via PostgREST) ============

create schema if not exists private;
grant usage on schema private to authenticated;

-- SECURITY DEFINER bypasses RLS on workspace_members to avoid recursive policies.
create or replace function private.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;
grant execute on function private.is_workspace_member(uuid) to authenticated;

-- ============ Row Level Security ============

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.team_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.resources enable row level security;
alter table public.calendar_events enable row level security;

create policy "members can read workspaces" on public.workspaces
  for select using (private.is_workspace_member(id));
create policy "owner can update workspace" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can delete workspace" on public.workspaces
  for delete using (owner_id = auth.uid());

create policy "members can read membership" on public.workspace_members
  for select using (private.is_workspace_member(workspace_id));

create policy "members manage team_members" on public.team_members
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage clients" on public.clients
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage projects" on public.projects
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage tasks" on public.tasks
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage resources" on public.resources
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage calendar_events" on public.calendar_events
  for all using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));

-- ============ Auto-provision workspace + owner on signup ============

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (name, owner_id)
    values (coalesce(new.raw_user_meta_data->>'workspace_name', 'My Workspace'), new.id)
    returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ============ Indexes ============

create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_ws on public.workspace_members(workspace_id);
create index idx_clients_ws on public.clients(workspace_id);
create index idx_projects_ws on public.projects(workspace_id);
create index idx_tasks_ws on public.tasks(workspace_id);
create index idx_team_members_ws on public.team_members(workspace_id);
create index idx_resources_ws on public.resources(workspace_id);

-- ============================================================================
-- Phase 5: invites, roles, and multi-workspace membership
-- (applied via migrations: invites_and_roles, restrict_accept_invite_to_authenticated,
--  invites_add_workspace_name — shown here as applied)
-- ============================================================================

-- workspace_members gains a denormalized email (set by the signup trigger and
-- accept_invite) so the member roster renders without reading auth.users.
alter table public.workspace_members add column if not exists email text;

-- Admin helper (owner or admin of the workspace)
create or replace function private.is_workspace_admin(ws uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;
grant execute on function private.is_workspace_admin(uuid) to authenticated;

-- handle_new_user also records the owner's email (see consolidated function above;
-- final version inserts workspace_members(..., email) with new.email).

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_name text,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index idx_invites_ws on public.invites(workspace_id);
create index idx_invites_email on public.invites(lower(email));
alter table public.invites enable row level security;

create policy "read invites (members or invitee)" on public.invites
  for select using (
    private.is_workspace_member(workspace_id)
    or lower(email) = lower(auth.jwt() ->> 'email')
  );
create policy "admins create invites" on public.invites
  for insert with check (private.is_workspace_admin(workspace_id));
create policy "admins delete invites" on public.invites
  for delete using (private.is_workspace_admin(workspace_id));

-- Admins can remove non-owner members
create policy "admins remove members" on public.workspace_members
  for delete using (private.is_workspace_admin(workspace_id) and role <> 'owner');

-- Accept an invite (validates the caller's email matches, then joins them)
create or replace function public.accept_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv record; uemail text;
begin
  select email into uemail from auth.users where id = auth.uid();
  select * into inv from public.invites where id = p_invite_id and status = 'pending';
  if inv is null then raise exception 'Invite not found or already used'; end if;
  if lower(inv.email) <> lower(uemail) then raise exception 'This invite is for a different email'; end if;
  insert into public.workspace_members (workspace_id, user_id, role, email)
    values (inv.workspace_id, auth.uid(), inv.role, uemail)
    on conflict (workspace_id, user_id) do nothing;
  update public.invites set status = 'accepted', accepted_at = now() where id = p_invite_id;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ============================================================================
-- Shareable invite links (migration: shareable_invite_links)
-- ============================================================================
-- Link invites carry a token and no email (email invites are the reverse).
alter table public.invites alter column email drop not null;
alter table public.invites add column if not exists token text;
create unique index if not exists idx_invites_token on public.invites(token) where token is not null;

-- Preview a link invite (token holder sees workspace + role before joining)
create or replace function public.get_invite_by_token(p_token text)
returns table(workspace_id uuid, workspace_name text, role text)
language sql security definer set search_path = public stable as $$
  select workspace_id, workspace_name, role
  from public.invites
  where token = p_token and status = 'pending' and email is null
  limit 1;
$$;
revoke execute on function public.get_invite_by_token(text) from public;
grant execute on function public.get_invite_by_token(text) to authenticated;

-- Join via link (reusable until the invite row is revoked)
create or replace function public.accept_invite_by_token(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record; uemail text;
begin
  select email into uemail from auth.users where id = auth.uid();
  select * into inv from public.invites
    where token = p_token and status = 'pending' and email is null limit 1;
  if inv is null then raise exception 'This invite link is invalid or has been revoked'; end if;
  insert into public.workspace_members (workspace_id, user_id, role, email)
    values (inv.workspace_id, auth.uid(), inv.role, uemail)
    on conflict (workspace_id, user_id) do nothing;
  return inv.workspace_id;
end;
$$;
revoke execute on function public.accept_invite_by_token(text) from public;
grant execute on function public.accept_invite_by_token(text) to authenticated;

-- ============================================================================
-- Board columns per workspace (migration: board_columns_per_workspace)
-- One jsonb row per workspace; replaces the old per-browser localStorage config.
-- ============================================================================
create table public.board_columns (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  columns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.board_columns enable row level security;
create policy "members manage board_columns" on public.board_columns
  for all using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

-- ============================================================================
-- Every login user is also an assignable team seat
-- (migrations: auto_team_seat_for_members, relock_invite_rpcs)
-- ============================================================================
-- handle_new_user / accept_invite / accept_invite_by_token now ALSO insert a
-- public.team_members row (name = email local-part, user_id linked) so a person
-- who can log in is immediately assignable to tasks. Existing members were
-- backfilled. Invite RPC EXECUTE was re-locked to the `authenticated` role after
-- the CREATE OR REPLACE reset the default grants.

-- ============================================================================
-- Capture the person's name at signup (migration: capture_name_at_signup)
-- ============================================================================
-- workspace_members gains a name column. handle_new_user + accept RPCs read
-- raw_user_meta_data->>'full_name' (collected on the signup form) and set both
-- the membership name and the team-seat name, so rosters and assignment show
-- real names instead of the email prefix. RPC grants re-locked after replace.
