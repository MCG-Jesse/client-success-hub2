-- Archiving completed tasks (applied to prod 2026-07-13, migrations
-- `tasks_archived_at` + `tasks_completed_at`). Mirror of what ran via MCP.

-- 1. archived_at: null = live, timestamp = archived (dropped from active views).
alter table public.tasks add column if not exists archived_at timestamptz;

-- 2. completed_at: when the task most recently became "completed". Used to
--    decide which done tasks are older than 30 days for bulk archiving.
alter table public.tasks add column if not exists completed_at timestamptz;

-- Stamp completed_at on the row itself so every path (drag-drop, checkbox,
-- modal) is covered without app changes. Set on entering 'completed', cleared
-- on leaving it, preserved while it stays completed.
create or replace function public.stamp_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_task_completed_at on public.tasks;
create trigger trg_stamp_task_completed_at
  before insert or update on public.tasks
  for each row execute function public.stamp_task_completed_at();

-- Backfill already-completed tasks (no completion time was ever recorded);
-- created_at is the best-available proxy for how old a done task is.
update public.tasks
  set completed_at = created_at
  where status = 'completed' and completed_at is null;
