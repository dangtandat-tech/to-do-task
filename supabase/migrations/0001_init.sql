-- Atelier — initial schema
-- Run this in the Supabase SQL Editor (or `supabase db push`).

create type quadrant as enum ('urgent_important', 'important', 'urgent', 'neither');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  day_capacity_min int  not null default 480,
  day_start_min    int  not null default 360,
  day_end_min      int  not null default 1380,
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projects
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#8a6d3b',
  sort_order int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index projects_user_idx on public.projects (user_id);

alter table public.projects enable row level security;

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  parent_id    uuid references public.tasks(id) on delete cascade,
  title        text not null,
  quadrant     quadrant not null default 'neither',
  due_date     date,
  estimate_min int,
  completed_at timestamptz,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index tasks_user_idx    on public.tasks (user_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_parent_idx  on public.tasks (parent_id);

alter table public.tasks enable row level security;

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backstop: a parent task cannot be completed while any subtask is open.
create or replace function public.check_parent_completion()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    if exists (
      select 1 from public.tasks
      where parent_id = new.id and completed_at is null
    ) then
      raise exception 'Cannot complete a task while subtasks are open';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_parent_completion
  before update on public.tasks
  for each row execute function public.check_parent_completion();

-- Backstop: only one level of nesting (a subtask cannot have subtasks).
create or replace function public.check_task_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if exists (
      select 1 from public.tasks
      where id = new.parent_id and parent_id is not null
    ) then
      raise exception 'Subtasks cannot have their own subtasks';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_depth
  before insert or update on public.tasks
  for each row execute function public.check_task_depth();

-- ---------------------------------------------------------------- schedule_blocks
create table public.schedule_blocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  plan_group_id uuid not null default gen_random_uuid(),
  day           date not null,
  start_min     int  not null check (start_min between 0 and 1439),
  duration_min  int  not null check (duration_min > 0),
  created_at    timestamptz not null default now()
);

create index blocks_user_day_idx on public.schedule_blocks (user_id, day);

alter table public.schedule_blocks enable row level security;

create policy "own blocks" on public.schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
