
-- Add 'medium' to severity enum
ALTER TYPE public.alert_severity ADD VALUE IF NOT EXISTS 'medium';

-- Workstation current activity (for Active Feed)
ALTER TABLE public.workstations
  ADD COLUMN IF NOT EXISTS current_window TEXT,
  ADD COLUMN IF NOT EXISTS current_process TEXT;

-- Webcam evidence
ALTER TABLE public.evidence_logs
  ADD COLUMN IF NOT EXISTS webcam_url TEXT;

-- Institutional App Vault
CREATE TABLE IF NOT EXISTS public.allowed_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  process_name TEXT NOT NULL,
  category TEXT,
  icon TEXT,
  whitelisted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (process_name)
);
ALTER TABLE public.allowed_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view apps" ON public.allowed_apps FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage apps" ON public.allowed_apps FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER allowed_apps_updated BEFORE UPDATE ON public.allowed_apps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Singleton system settings (focus mode)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  focus_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view settings" ON public.system_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.system_settings (id, focus_mode) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
CREATE TRIGGER system_settings_updated BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common apps
INSERT INTO public.allowed_apps (name, process_name, category, icon) VALUES
  ('Visual Studio Code', 'Code.exe', 'IDE', '💻'),
  ('BlueJ', 'bluej.exe', 'IDE', '☕'),
  ('IntelliJ IDEA', 'idea64.exe', 'IDE', '🧠'),
  ('PyCharm', 'pycharm64.exe', 'IDE', '🐍'),
  ('Eclipse', 'eclipse.exe', 'IDE', '🌑'),
  ('Sublime Text', 'sublime_text.exe', 'IDE', '📝'),
  ('Notepad++', 'notepad++.exe', 'Editor', '📓'),
  ('Google Chrome', 'chrome.exe', 'Browser', '🌐'),
  ('Microsoft Edge', 'msedge.exe', 'Browser', '🧭'),
  ('Mozilla Firefox', 'firefox.exe', 'Browser', '🦊'),
  ('Microsoft Word', 'WINWORD.EXE', 'Office', '📄'),
  ('Microsoft Excel', 'EXCEL.EXE', 'Office', '📊'),
  ('Microsoft PowerPoint', 'POWERPNT.EXE', 'Office', '📽️'),
  ('Calculator', 'CalculatorApp.exe', 'Utility', '🧮'),
  ('Command Prompt', 'cmd.exe', 'Terminal', '⌨️'),
  ('PowerShell', 'powershell.exe', 'Terminal', '⚡'),
  ('Windows Terminal', 'WindowsTerminal.exe', 'Terminal', '🖥️'),
  ('File Explorer', 'explorer.exe', 'System', '📁'),
  ('Acrobat Reader', 'AcroRd32.exe', 'Office', '📕'),
  ('Microsoft Teams', 'Teams.exe', 'Communication', '👥')
ON CONFLICT (process_name) DO NOTHING;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.allowed_apps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
