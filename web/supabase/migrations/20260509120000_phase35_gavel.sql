-- ============================================================
-- PHASE 3.5 — The Principal's Gavel
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- De-bloat
drop table if exists public.waste_captures cascade;
drop table if exists public.temp_logs cascade;
drop table if exists public.heartbeat_logs cascade;

-- Ambient activity log (Shadow Surveillance)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid references public.workstations(id) on delete cascade,
  process_name text,
  window_title text,
  severity text not null default 'info' check (severity in ('info','warning')),
  is_anomaly boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_ws_created_idx
  on public.activity_logs (workstation_id, created_at desc);
create index if not exists activity_logs_anomaly_idx
  on public.activity_logs (is_anomaly, created_at desc) where is_anomaly;

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs read auth" on public.activity_logs;
create policy "activity_logs read auth"
  on public.activity_logs for select
  to authenticated using (true);

drop policy if exists "activity_logs insert service" on public.activity_logs;
create policy "activity_logs insert service"
  on public.activity_logs for insert
  to service_role with check (true);

do $$ begin
  perform 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='activity_logs';
  if not found then
    execute 'alter publication supabase_realtime add table public.activity_logs';
  end if;
end $$;

-- Evidence storage policies
drop policy if exists "evidence service all" on storage.objects;
create policy "evidence service all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'evidence')
  with check (bucket_id = 'evidence');

drop policy if exists "evidence auth read" on storage.objects;
create policy "evidence auth read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidence');

drop policy if exists "evidence public read" on storage.objects;
create policy "evidence public read"
  on storage.objects for select
  to anon
  using (bucket_id = 'evidence');

-- Telegram Gavel: fire edge function on critical alerts
create or replace function public.notify_principal_on_critical()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url text := 'https://mbelumnusmqpodjokqox.supabase.co/functions/v1/notify-principal';
  shared_secret text;
begin
  begin
    shared_secret := current_setting('app.gavel_secret', true);
  exception when others then
    shared_secret := null;
  end;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gavel-secret', coalesce(shared_secret, '')
    ),
    body := jsonb_build_object(
      'alert_id', new.id,
      'workstation_id', new.workstation_id
    )
  );
  return new;
end;
$$;

drop trigger if exists alerts_critical_notify on public.alerts;
create trigger alerts_critical_notify
  after insert on public.alerts
  for each row
  when (new.severity = 'critical')
  execute function public.notify_principal_on_critical();
