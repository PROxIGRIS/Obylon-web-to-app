-- ============================================================
-- Phase 7 — Expand app_role enum & align RBAC hierarchy
-- ============================================================
-- The original enum was ('admin', 'moderator', 'user').
-- The application uses: dev, admin, principal, teacher, helper.
-- This migration adds the missing values and drops the unused ones
-- (Postgres enums cannot drop values, but we can leave them harmless).
-- ============================================================

-- 1. Add missing enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dev';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'helper';

-- 2. Completed status for action_status (used by admin_actions)
ALTER TYPE public.action_status ADD VALUE IF NOT EXISTS 'completed';

-- 3. Drop the old restrictive "Admins manage roles" policy so we can
--    replace it with hierarchy-aware policies.
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

-- 4. Dev manages all roles (full access)
DROP POLICY IF EXISTS "Dev manages all roles" ON public.user_roles;
CREATE POLICY "Dev manages all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING  (public.has_any_role(auth.uid(), ARRAY['dev'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dev'::app_role]));

-- 5. Principal/Admin can manage subordinate roles only (teacher, helper)
DROP POLICY IF EXISTS "Principal manages subordinate roles" ON public.user_roles;
CREATE POLICY "Principal manages subordinate roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['principal'::app_role, 'admin'::app_role])
    AND role IN ('teacher'::app_role, 'helper'::app_role)
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['principal'::app_role, 'admin'::app_role])
    AND role IN ('teacher'::app_role, 'helper'::app_role)
  );

-- 6. Bootstrap policy: first user can self-grant dev/admin/principal if none exist
DROP POLICY IF EXISTS "Bootstrap first privileged user" ON public.user_roles;
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

-- 7. Grant dev/principal/admin read access to all profiles
--    (they need to see all users in the dev dashboard)
DROP POLICY IF EXISTS "Elevated view all profiles" ON public.profiles;
CREATE POLICY "Elevated view all profiles" ON public.profiles
  FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role])
  );

-- 8. Revoke anon from has_any_role (security hardening)
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
