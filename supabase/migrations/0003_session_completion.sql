-- Per-day sessions: each block of a multi-day plan is finished on its own.
-- The task itself closes only when every one of its sessions is done.
alter table public.schedule_blocks
  add column if not exists completed_at timestamptz;

-- Existing plans of already-finished tasks count as fully done, so old data
-- does not suddenly read as "0/3 days".
update public.schedule_blocks b
   set completed_at = t.completed_at
  from public.tasks t
 where t.id = b.task_id
   and t.completed_at is not null
   and b.completed_at is null;
