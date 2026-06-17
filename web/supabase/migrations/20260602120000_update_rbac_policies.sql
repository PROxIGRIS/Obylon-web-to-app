-- 1. Create a helper function to check multiple roles at once
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- 2. Redefine has_role so checking for 'admin' also authorizes 'dev' and 'principal'
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND (
      role = _role
      OR (_role = 'admin' AND role IN ('admin', 'dev', 'principal'))
    )
  )
$$;

-- 3. Add explicit read-only policies for 'teacher' and 'helper' across all relevant tables
CREATE POLICY "Staff view workstations" ON public.workstations FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view alerts" ON public.alerts FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view evidence" ON public.evidence_logs FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view profiles" ON public.profiles FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view apps" ON public.allowed_apps FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view settings" ON public.system_settings FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view actions" ON public.admin_actions FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
CREATE POLICY "Staff view roles" ON public.user_roles FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['teacher'::app_role, 'helper'::app_role]));
