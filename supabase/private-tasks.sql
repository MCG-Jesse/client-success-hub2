-- Private tasks feature — STAGED, not yet applied to production.
-- Adds per-user private tasks: a task marked private is visible/editable
-- ONLY to its creator; all other workspace members (incl. owner/admin) can't
-- see it, even in shared views. Enforcement is in the DB (RLS), not just UI.
--
-- Safe/additive: new columns default to non-private, so every existing task
-- stays visible to the whole workspace exactly as before.

-- 1. New columns on public.tasks
--    created_by uses ON DELETE SET NULL so deleting a user does NOT block on
--    (or destroy) their tasks — it just unsets the creator stamp, preserving
--    the existing "delete user -> workspace data cascades" behavior.
alter table public.tasks
  add column if not exists is_private boolean not null default false,
  add column if not exists created_by uuid
    references auth.users(id) on delete set null default auth.uid();

-- 2. Tighten row access so private tasks are creator-only.
--    Replaces the single "members manage tasks" ALL policy.
drop policy if exists "members manage tasks" on public.tasks;

create policy "members manage tasks" on public.tasks
  for all
  using (
    private.is_workspace_member(workspace_id)
    and (is_private = false or created_by = auth.uid())
  )
  with check (
    private.is_workspace_member(workspace_id)
    and (is_private = false or created_by = auth.uid())
  );
