-- Phase 5 — Mobile Push Bridge
-- Stores FCM device tokens for faculty phones. Critical alerts fan out here.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_self_select" on public.device_tokens;
create policy "device_tokens_self_select" on public.device_tokens
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "device_tokens_self_insert" on public.device_tokens;
create policy "device_tokens_self_insert" on public.device_tokens
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "device_tokens_self_update" on public.device_tokens;
create policy "device_tokens_self_update" on public.device_tokens
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "device_tokens_self_delete" on public.device_tokens;
create policy "device_tokens_self_delete" on public.device_tokens
  for delete to authenticated using (auth.uid() = user_id);
