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
