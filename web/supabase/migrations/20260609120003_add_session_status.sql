ALTER TABLE public.user_sessions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
