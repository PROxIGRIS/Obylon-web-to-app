-- Migration: add_banned_users and unban_requests

CREATE TABLE IF NOT EXISTS public.banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for banned_users
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dev/Admin/Principal can view all banned users"
ON public.banned_users FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));

CREATE POLICY "Users can view their own ban status"
ON public.banned_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Elevated roles can ban users"
ON public.banned_users FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));

CREATE POLICY "Elevated roles can unban users"
ON public.banned_users FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));

-- Unban requests table
CREATE TABLE IF NOT EXISTS public.unban_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.unban_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated roles can view unban requests"
ON public.unban_requests FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));

CREATE POLICY "Users can view their own unban requests"
ON public.unban_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Banned users can insert unban requests"
ON public.unban_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Elevated roles can update unban requests"
ON public.unban_requests FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role]));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banned_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unban_requests TO authenticated;
