-- ============================================================
-- Create unauthorized_window_settings & unauthorized_events tables
-- These tables power the Class Activity Log (violations page).
-- ============================================================

-- 1. unauthorized_window_settings — single-row config for the active monitoring window
CREATE TABLE IF NOT EXISTS public.unauthorized_window_settings (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  start_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ NOT NULL,
  clear_at   TIMESTAMPTZ NOT NULL,
  clear_delay_seconds INTEGER NOT NULL DEFAULT 1800,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT end_after_start CHECK (end_at > start_at),
  CONSTRAINT clear_after_end CHECK (clear_at >= end_at)
);

ALTER TABLE public.unauthorized_window_settings ENABLE ROW LEVEL SECURITY;

-- Elevated roles (dev, principal, admin, teacher) can read & manage the window
DROP POLICY IF EXISTS "Elevated read window settings" ON public.unauthorized_window_settings;
CREATE POLICY "Elevated read window settings"
  ON public.unauthorized_window_settings FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  );

DROP POLICY IF EXISTS "Elevated manage window settings" ON public.unauthorized_window_settings;
CREATE POLICY "Elevated manage window settings"
  ON public.unauthorized_window_settings FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  );

-- Auto-update timestamp trigger
DROP TRIGGER IF EXISTS unauthorized_window_settings_updated ON public.unauthorized_window_settings;
CREATE TRIGGER unauthorized_window_settings_updated
  BEFORE UPDATE ON public.unauthorized_window_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. unauthorized_events — individual violation records per workstation/process
DO $$ BEGIN
    CREATE TYPE public.unauthorized_event_kind AS ENUM ('unauthorized', 'un-added');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.unauthorized_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id   UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  process_name     TEXT NOT NULL,
  window_title     TEXT,
  kind             unauthorized_event_kind NOT NULL DEFAULT 'unauthorized',
  payload          TEXT,                    -- extracted typing data, if any
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT now(),  -- first seen
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unauthorized_events ENABLE ROW LEVEL SECURITY;

-- Elevated roles can read events
DROP POLICY IF EXISTS "Elevated read unauthorized events" ON public.unauthorized_events;
CREATE POLICY "Elevated read unauthorized events"
  ON public.unauthorized_events FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  );

-- Elevated roles can manage events (insert/update/delete for the sentinel agent + UI)
DROP POLICY IF EXISTS "Elevated manage unauthorized events" ON public.unauthorized_events;
CREATE POLICY "Elevated manage unauthorized events"
  ON public.unauthorized_events FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'principal'::app_role, 'admin'::app_role, 'teacher'::app_role])
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_unauthorized_events_workstation
  ON public.unauthorized_events(workstation_id);

CREATE INDEX IF NOT EXISTS idx_unauthorized_events_last_seen
  ON public.unauthorized_events(last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_unauthorized_events_lookup
  ON public.unauthorized_events(workstation_id, process_name, kind);

-- Enable realtime for live updates (safe to run if already added)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'unauthorized_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unauthorized_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'unauthorized_window_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unauthorized_window_settings;
  END IF;
END $$;
