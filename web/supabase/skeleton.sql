-- ============================================================================
-- Nexus Sentinel — Full Database Skeleton (no data)
-- ----------------------------------------------------------------------------
-- Drop this into a brand-new Supabase project's SQL editor and run top-to-bottom.
-- Recreates every table, enum, function, trigger, index, RLS policy,
-- realtime publication, and the `evidence` storage bucket with its policies.
--
-- After running:
--   1. Update VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
--      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in your env.
--   2. Update the `fn_url` hard-coded inside notify_principal_on_critical()
--      below to point at your new project's edge function URL.
--   3. (Optional) set `app.gavel_secret` via:
--          ALTER DATABASE postgres SET app.gavel_secret = 'your-secret';
--   4. Insert your admin user_role row:
--          INSERT INTO public.user_roles (user_id, role)
--          VALUES ('<your-auth-user-uuid>', 'admin');
-- ============================================================================

BEGIN;

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ============================================================================
-- 1. ENUMS
-- ============================================================================
CREATE TYPE public.app_role            AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.workstation_status  AS ENUM ('online', 'offline');
CREATE TYPE public.alert_severity      AS ENUM ('info', 'warning', 'medium', 'high', 'critical');
CREATE TYPE public.admin_command       AS ENUM ('lock', 'terminate', 'freeze', 'unfreeze', 'kill_task', 'set_alias');
CREATE TYPE public.action_status       AS ENUM ('pending', 'sent', 'acknowledged', 'failed', 'completed');


-- ============================================================================
-- 2. SHARED FUNCTIONS (created before tables that trigger them)
-- ============================================================================

-- Generic updated_at touch
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Role check (SECURITY DEFINER avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (
      role = _role
      OR (_role = 'admin' AND role IN ('admin', 'dev', 'principal'))
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = ANY(_roles)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon;


-- ============================================================================
-- 3. TABLES (created in dependency order)
-- ============================================================================

-- ---- user_roles -----------------------------------------------------------
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ---- profiles -------------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- workstations ---------------------------------------------------------
CREATE TABLE public.workstations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  status           public.workstation_status NOT NULL DEFAULT 'offline',
  last_heartbeat   TIMESTAMPTZ,
  os_info          JSONB,
  current_window   TEXT,
  current_process  TEXT,
  ip_address       TEXT,
  allowed_app      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- alerts ---------------------------------------------------------------
CREATE TABLE public.alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id  UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  process_name    TEXT,
  window_title    TEXT,
  severity        public.alert_severity NOT NULL DEFAULT 'info',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_timestamp   ON public.alerts (timestamp DESC);
CREATE INDEX idx_alerts_workstation ON public.alerts (workstation_id);

-- ---- evidence_logs --------------------------------------------------------
CREATE TABLE public.evidence_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  screenshot_url  TEXT,
  webcam_url      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- admin_actions --------------------------------------------------------
CREATE TABLE public.admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command       public.admin_command NOT NULL,
  target_id     UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  status        public.action_status NOT NULL DEFAULT 'pending',
  issued_by     UUID REFERENCES auth.users(id),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX admin_actions_target_status_idx
  ON public.admin_actions (target_id, status, created_at DESC);

-- ---- activity_logs (ambient surveillance) ---------------------------------
CREATE TABLE public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id  UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  process_name    TEXT,
  window_title    TEXT,
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning')),
  is_anomaly      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_ws_created_idx ON public.activity_logs (workstation_id, created_at DESC);
CREATE INDEX activity_logs_anomaly_idx    ON public.activity_logs (is_anomaly, created_at DESC) WHERE is_anomaly;

-- ---- allowed_apps ---------------------------------------------------------
CREATE TABLE public.allowed_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  process_name  TEXT NOT NULL UNIQUE,
  category      TEXT,
  icon          TEXT,
  whitelisted   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- system_settings (singleton) ------------------------------------------
CREATE TABLE public.system_settings (
  id          INT PRIMARY KEY DEFAULT 1,
  focus_mode  BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.system_settings (id, focus_mode) VALUES (1, false);

-- ---- device_tokens (mobile push) ------------------------------------------
CREATE TABLE public.device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user_idx ON public.device_tokens (user_id);


-- ============================================================================
-- 4. GRANTS (PostgREST needs explicit table privileges in public schema)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workstations     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_logs    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_actions    TO authenticated;
GRANT SELECT                          ON public.activity_logs    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_apps     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens    TO authenticated;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_apps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens    ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE POLICY "Users view own roles"  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Hierarchical management:
--   dev       -> any role (incl. dev/admin/principal)
--   principal -> only teacher / helper
--   admin     -> only teacher / helper
CREATE POLICY "Dev manages all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dev'::app_role]));
CREATE POLICY "Principal manages subordinate roles" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['principal'::app_role, 'admin'::app_role])
    AND role IN ('teacher'::app_role, 'helper'::app_role)
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['principal'::app_role, 'admin'::app_role])
    AND role IN ('teacher'::app_role, 'helper'::app_role)
  );

-- Bootstrap: when no privileged user exists yet, the first authenticated user
-- can self-grant 'dev' / 'admin' / 'principal'. Becomes inert as soon as one exists.
CREATE POLICY "Bootstrap first privileged user" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role IN ('dev', 'admin', 'principal')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE role IN ('dev', 'admin', 'principal')
    )
  );

-- profiles
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view profiles"      ON public.profiles FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Elevated view all profiles" ON public.profiles FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));
CREATE POLICY "Elevated delete profiles" ON public.profiles FOR DELETE USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- workstations
CREATE POLICY "Admins view workstations"   ON public.workstations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage workstations" ON public.workstations FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- alerts
CREATE POLICY "Admins view alerts"   ON public.alerts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage alerts" ON public.alerts FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- evidence_logs
CREATE POLICY "Admins view evidence"   ON public.evidence_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage evidence" ON public.evidence_logs FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- admin_actions
CREATE POLICY "Admins view actions"   ON public.admin_actions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage actions" ON public.admin_actions FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- activity_logs
CREATE POLICY "activity_logs read auth"      ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_logs insert service" ON public.activity_logs FOR INSERT TO service_role WITH CHECK (true);

-- allowed_apps
CREATE POLICY "Admins view apps"   ON public.allowed_apps FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage apps" ON public.allowed_apps FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- system_settings
CREATE POLICY "Admins view settings"   ON public.system_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL    USING (public.has_role(auth.uid(), 'admin'));

-- device_tokens
CREATE POLICY "device_tokens_self_select" ON public.device_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "device_tokens_self_insert" ON public.device_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_tokens_self_update" ON public.device_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "device_tokens_self_delete" ON public.device_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ============================================================================
-- 6. TRIGGERS (updated_at + auth user fan-out + telegram gavel)
-- ============================================================================

-- updated_at triggers
CREATE TRIGGER profiles_updated        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER workstations_updated    BEFORE UPDATE ON public.workstations    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER allowed_apps_updated    BEFORE UPDATE ON public.allowed_apps    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Telegram / push fan-out on critical alerts
-- NOTE: update fn_url to your new project's edge function URL after restore.
CREATE OR REPLACE FUNCTION public.notify_principal_on_critical()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url        TEXT := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify-principal';
  shared_secret TEXT;
BEGIN
  BEGIN
    shared_secret := current_setting('app.gavel_secret', true);
  EXCEPTION WHEN OTHERS THEN
    shared_secret := NULL;
  END;

  PERFORM net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-gavel-secret',  COALESCE(shared_secret, '')
    ),
    body    := jsonb_build_object(
      'alert_id',       NEW.id,
      'workstation_id', NEW.workstation_id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER alerts_critical_notify
AFTER INSERT ON public.alerts
FOR EACH ROW
WHEN (NEW.severity = 'critical')
EXECUTE FUNCTION public.notify_principal_on_critical();

-- Server-side whitelist guard: never freeze a whitelisted process
CREATE OR REPLACE FUNCTION public.guard_freeze_against_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_proc TEXT;
  is_whitelisted BOOLEAN;
BEGIN
  IF NEW.command <> 'freeze' THEN
    RETURN NEW;
  END IF;
  SELECT current_process INTO current_proc FROM public.workstations WHERE id = NEW.target_id;
  IF current_proc IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT whitelisted INTO is_whitelisted
    FROM public.allowed_apps
    WHERE lower(process_name) = lower(current_proc);
  IF COALESCE(is_whitelisted, false) THEN
    RAISE EXCEPTION 'freeze rejected: target process % is whitelisted', current_proc
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER admin_actions_whitelist_guard
BEFORE INSERT ON public.admin_actions
FOR EACH ROW EXECUTE FUNCTION public.guard_freeze_against_whitelist();


-- ============================================================================
-- 7. REALTIME PUBLICATION
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.workstations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.allowed_apps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;


-- ============================================================================
-- 8. STORAGE BUCKET + POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidence service all"
  ON storage.objects FOR ALL
  TO service_role
  USING      (bucket_id = 'evidence')
  WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "evidence auth read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidence');

CREATE POLICY "evidence public read"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'evidence');


-- ============================================================================
-- 9. SEED — non-data essentials only
-- ----------------------------------------------------------------------------
-- The allowed_apps catalog is configuration, not user data — kept so the agent
-- has a sensible default whitelist on a fresh database. Delete this block if
-- you want a truly empty skeleton.
-- ============================================================================
INSERT INTO public.allowed_apps (name, process_name, category, icon) VALUES
  ('Visual Studio Code',     'Code.exe',             'IDE',           '💻'),
  ('BlueJ',                  'bluej.exe',            'IDE',           '☕'),
  ('IntelliJ IDEA',          'idea64.exe',           'IDE',           '🧠'),
  ('PyCharm',                'pycharm64.exe',        'IDE',           '🐍'),
  ('Eclipse',                'eclipse.exe',          'IDE',           '🌑'),
  ('Sublime Text',           'sublime_text.exe',     'IDE',           '📝'),
  ('Notepad++',              'notepad++.exe',        'Editor',        '📓'),
  ('Google Chrome',          'chrome.exe',           'Browser',       '🌐'),
  ('Microsoft Edge',         'msedge.exe',           'Browser',       '🧭'),
  ('Mozilla Firefox',        'firefox.exe',          'Browser',       '🦊'),
  ('Microsoft Word',         'WINWORD.EXE',          'Office',        '📄'),
  ('Microsoft Excel',        'EXCEL.EXE',            'Office',        '📊'),
  ('Microsoft PowerPoint',   'POWERPNT.EXE',         'Office',        '📽️'),
  ('Calculator',             'CalculatorApp.exe',    'Utility',       '🧮'),
  ('Command Prompt',         'cmd.exe',              'Terminal',      '⌨️'),
  ('PowerShell',             'powershell.exe',       'Terminal',      '⚡'),
  ('Windows Terminal',       'WindowsTerminal.exe',  'Terminal',      '🖥️'),
  ('File Explorer',          'explorer.exe',         'System',        '📁'),
  ('Acrobat Reader',         'AcroRd32.exe',         'Office',        '📕'),
  ('Microsoft Teams',        'Teams.exe',            'Communication', '👥')
ON CONFLICT (process_name) DO NOTHING;

COMMIT;

-- ============================================================================
-- POST-RESTORE CHECKLIST
-- ----------------------------------------------------------------------------
-- [ ] Update env vars (VITE_SUPABASE_URL / PUBLISHABLE_KEY / SERVICE_ROLE_KEY)
-- [ ] Edit fn_url inside notify_principal_on_critical() to match new project ref
-- [ ] Deploy edge function `notify-principal` and set its secrets
--     (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, EDGE_SHARED_SECRET)
-- [ ] ALTER DATABASE postgres SET app.gavel_secret = '<EDGE_SHARED_SECRET>';
-- [ ] INSERT admin user into public.user_roles after first sign-up
-- ============================================================================
