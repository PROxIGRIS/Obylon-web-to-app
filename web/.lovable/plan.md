# Phase 3.5 — The Principal's Gavel

Five sequenced workstreams. Each ships and verifies independently.

## 1. Telegram Gavel (critical-only escalation)

**DB migration**
- `pg_net` extension enabled.
- Trigger `alerts_critical_notify` AFTER INSERT on `alerts` WHEN `NEW.severity = 'critical'` → `net.http_post` to the edge function with `{ alert_id, workstation_id }`.
- Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `EDGE_SHARED_SECRET` as Cloud secrets.

**Edge function `notify-principal`** (`supabase/functions/notify-principal/index.ts`)
- Verifies shared secret header.
- Joins `alerts → workstations` for node name + window title.
- Posts to Telegram Bot API:
  ```
  🚨 CRITICAL — {workstation.name}
  {process} · {window_title}
  Forensic case: {SITE_URL}/case/{alert_id}
  ```
- Returns 200/4xx with structured logging.

## 2. Shadow Surveillance (ambient logging)

**Schema**
- New `activity_logs` table: `id, workstation_id, process_name, window_title, severity ('info'|'warning'), is_anomaly bool, created_at` + index `(workstation_id, created_at desc)`.
- RLS: authenticated read, service-role insert.
- Realtime publication on `activity_logs`.

**Agent** (`scripts/sentinel_agent.py`)
- Track `last_seen_processes` set per loop; on diff, insert minimal row to `activity_logs`.
- If process not in `allowed_apps` AND focus mode OFF → severity `warning`, `is_anomaly=true`, no Telegram.
- Focus-mode ON path unchanged → still emits `alerts` row (HIGH).

**UI**
- `ActiveFeed`: add "Ambient" tab showing recent `activity_logs` (warnings highlighted sage).

## 3. DB de-bloat & schema hardening

- Migration: `DROP TABLE IF EXISTS waste_captures, temp_logs CASCADE;` (guarded).
- Dedupe `workstations` heartbeat path: agent uses single `.upsert(on_conflict='name')` with `last_seen=now()` (already roughly the case — verify and document).
- Storage policies on `evidence` bucket:
  ```
  CREATE POLICY "service_role full" ON storage.objects
    FOR ALL TO service_role USING (bucket_id='evidence') WITH CHECK (bucket_id='evidence');
  CREATE POLICY "auth read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id='evidence');
  ```

## 4. Severity re-tier (noise filter)

Update `scripts/lexicon.py`:
- **CRITICAL** (Telegram): adult content keywords, VPN/proxy (`nordvpn|protonvpn|psiphon|ultrasurf|tor\.exe|warp`).
- **HIGH** (faculty): gaming (`steam|valorant|league|minecraft|fortnite`), hacking (`wireshark|nmap|metasploit|burpsuite|kali`), focus-mode violations.
- **WARNING/INFO** (ambient only): `discord|tiktok|instagram|facebook|youtube|netflix|twitch` → goes to `activity_logs`, not `alerts`.

Agent severity dispatch updated; `alerts` row only created for HIGH/CRITICAL.

## 5. Performance & UI sovereignty

**Perf**
- Heartbeat liveness: derive status client-side — `online` if `last_seen` within 10s, `interrupted` if missed >3 beats (>30s), `offline` if >2min. Update `Heartbeat`, `WorkstationTable`, `WorkstationGrid`, `ActiveFeed`.
- Memoize `WorkstationTable` rows; coalesce realtime updates with 250ms ref-flush.

**Mobile**
- `Shell` header collapses to hamburger under `md`.
- `WorkstationTable` → vertical card list under `md` (high-density: name · status dot · last-seen · severity badge).
- `apps.tsx` registry: stack to single column under `md`.
- `Terminal`: horizontal scroll + new column `[node]` prefix on every line (e.g. `[LAB-PC-07] 12:04:55 process spawn …`).

**UX simplification**
- Dashboard header: replace jargon ("Neural Grid", "Sovereignty") with plain labels in a "Simple mode" toggle stored in localStorage. Default = simple. Power users opt into cinematic copy.
- Add inline help tooltips on Focus Mode toggle and severity badges.

**Theme audit**
- Grep components for stray hex / `text-white` / `bg-black`; replace with tokens (`bg-background`, `text-foreground`, `bg-accent`, `text-accent-foreground`).
- Confirm `--background: #fcfaf2`, `--foreground: #2e2f30`, `--accent: #c2d1c2` (already set in oklch).

## Sequencing

1. Migrations: `activity_logs`, drop bloat tables, storage RLS, alerts trigger + `pg_net`.
2. Add Telegram secrets, ship `notify-principal` edge function, smoke-test with manual insert.
3. Update `scripts/lexicon.py` + `sentinel_agent.py` (ambient logging, severity re-tier, upsert hardening).
4. UI: heartbeat logic, mobile refactor, terminal node prefix, simple-mode toggle, ambient feed tab.
5. Theme + copy audit pass.

## Approval needed before I start

- Confirm Telegram bot token + target chat ID will be provided when I prompt for secrets (I'll request `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `EDGE_SHARED_SECRET`).
- Confirm OK to **drop** `waste_captures` and `temp_logs` (data loss is intended per brief).
- Confirm "Simple mode" default = ON (plain English labels) is acceptable; cinematic copy stays as opt-in.

Approve and I'll execute section 1 → 5, verifying after each.