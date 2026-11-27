-- Run this script in the Supabase SQL Editor.
-- V3 has its own progress table and does not overwrite V1 or V2.

create table if not exists public.user_progress_v3 (
  userid uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress_v3 enable row level security;

drop policy if exists "Users can read their own V3 progress" on public.user_progress_v3;
create policy "Users can read their own V3 progress"
on public.user_progress_v3 for select
using (auth.uid() = userid);

drop policy if exists "Users can insert their own V3 progress" on public.user_progress_v3;
create policy "Users can insert their own V3 progress"
on public.user_progress_v3 for insert
with check (auth.uid() = userid);

drop policy if exists "Users can update their own V3 progress" on public.user_progress_v3;
create policy "Users can update their own V3 progress"
on public.user_progress_v3 for update
using (auth.uid() = userid)
with check (auth.uid() = userid);

grant usage on schema public to authenticated;
grant select, insert, update on table public.user_progress_v3 to authenticated;
