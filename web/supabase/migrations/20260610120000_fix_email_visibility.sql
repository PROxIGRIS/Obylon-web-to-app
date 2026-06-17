-- Recreate has_role to handle dev/principal mappings correctly
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

-- Ensure has_any_role exists
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = ANY(_roles)
  )
$$;

-- Add Elevated view all profiles
DROP POLICY IF EXISTS "Elevated view all profiles" ON public.profiles;
CREATE POLICY "Elevated view all profiles" ON public.profiles FOR SELECT USING (
  public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role])
);

-- Add Elevated delete profiles
DROP POLICY IF EXISTS "Elevated delete profiles" ON public.profiles;
CREATE POLICY "Elevated delete profiles" ON public.profiles FOR DELETE USING (
  public.has_any_role(auth.uid(), ARRAY['dev'::app_role, 'admin'::app_role, 'principal'::app_role])
);
