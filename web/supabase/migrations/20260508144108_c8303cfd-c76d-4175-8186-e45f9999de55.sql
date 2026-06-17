
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Severity enum
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical', 'high');
CREATE TYPE public.workstation_status AS ENUM ('online', 'offline');
CREATE TYPE public.admin_command AS ENUM ('lock', 'terminate');
CREATE TYPE public.action_status AS ENUM ('pending', 'sent', 'acknowledged', 'failed');

-- Workstations
CREATE TABLE public.workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status workstation_status NOT NULL DEFAULT 'offline',
  last_heartbeat TIMESTAMPTZ,
  os_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view workstations" ON public.workstations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage workstations" ON public.workstations FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER workstations_updated BEFORE UPDATE ON public.workstations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  process_name TEXT,
  window_title TEXT,
  severity alert_severity NOT NULL DEFAULT 'info',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view alerts" ON public.alerts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage alerts" ON public.alerts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_alerts_timestamp ON public.alerts(timestamp DESC);
CREATE INDEX idx_alerts_workstation ON public.alerts(workstation_id);

-- Evidence
CREATE TABLE public.evidence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  screenshot_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view evidence" ON public.evidence_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage evidence" ON public.evidence_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin actions
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command admin_command NOT NULL,
  target_id UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  status action_status NOT NULL DEFAULT 'pending',
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view actions" ON public.admin_actions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage actions" ON public.admin_actions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Heartbeats
CREATE TABLE public.heartbeat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id UUID REFERENCES public.workstations(id) ON DELETE CASCADE,
  uptime BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.heartbeat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view heartbeats" ON public.heartbeat_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_heartbeat_workstation_time ON public.heartbeat_logs(workstation_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workstations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.heartbeat_logs;
