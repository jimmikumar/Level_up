-- Run this script in Supabase SQL Editor.
-- V2 uses a separate table so it never overwrites LevelUp V1 progress.

create table if not exists public.user_progress_v2 (
  userid uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress_v2 enable row level security;

drop policy if exists "Users can read their own V2 progress" on public.user_progress_v2;
create policy "Users can read their own V2 progress"
on public.user_progress_v2 for select
using (auth.uid() = userid);

drop policy if exists "Users can insert their own V2 progress" on public.user_progress_v2;
create policy "Users can insert their own V2 progress"
on public.user_progress_v2 for insert
with check (auth.uid() = userid);

drop policy if exists "Users can update their own V2 progress" on public.user_progress_v2;
create policy "Users can update their own V2 progress"
on public.user_progress_v2 for update
using (auth.uid() = userid)
with check (auth.uid() = userid);
