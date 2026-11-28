-- Run this once in the Supabase SQL Editor.
-- Stores Telegram chat identifiers only. Never store the bot token here.
create table if not exists public.telegram_connections (
  userid uuid primary key references auth.users(id) on delete cascade,
  chat_id text not null unique,
  linked_at timestamptz not null default now()
);

alter table public.telegram_connections enable row level security;

drop policy if exists "Users can read their own Telegram connection" on public.telegram_connections;
create policy "Users can read their own Telegram connection"
on public.telegram_connections for select
to authenticated
using (auth.uid() = userid);

-- No client insert/update/delete policies are created.
-- The Worker uses the Supabase service role key stored as a Worker secret.
