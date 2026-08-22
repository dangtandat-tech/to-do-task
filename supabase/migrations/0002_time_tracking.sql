-- Time tracking: minutes actually worked on a task (logged by the focus timer)
alter table public.tasks add column if not exists spent_min int not null default 0;
