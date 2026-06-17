-- Run this manually in the Supabase SQL editor.
-- Grants teachers the ability to assign/revoke the 'helper' role only.

DROP POLICY IF EXISTS "Teacher manages helpers" ON public.user_roles;
CREATE POLICY "Teacher manages helpers" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['teacher'::app_role])
    AND role = 'helper'::app_role
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['teacher'::app_role])
    AND role = 'helper'::app_role
  );

DROP POLICY IF EXISTS "Teacher view profiles" ON public.profiles;
CREATE POLICY "Teacher view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role]));
