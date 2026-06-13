
-- 1. Restrict display_branding: drop public SELECT; add RPC for anon pair-code access
DROP POLICY IF EXISTS "Public read branding" ON public.display_branding;
CREATE POLICY "Clinic staff read branding"
  ON public.display_branding FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.get_display_branding_by_pair(p_pair_code text)
RETURNS public.display_branding
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.*
  FROM public.display_branding b
  JOIN public.display_screens s ON s.clinic_id = b.clinic_id
  WHERE s.pair_code = upper(p_pair_code)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_display_branding_by_pair(text) TO anon, authenticated;

-- 2. Restrict lower_third_presets: drop public SELECT (staff policy covers SELECT)
DROP POLICY IF EXISTS "Public read presets" ON public.lower_third_presets;

-- 3. Lock down edge_function_failures writes to service_role only
DROP POLICY IF EXISTS "service writes failures" ON public.edge_function_failures;
CREATE POLICY "service_role writes failures"
  ON public.edge_function_failures FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. Remove direct anon insert on patients (self-register uses SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Anon self-register insert" ON public.patients;

-- 5. Remove direct anon insert on queue_tokens (self-register RPC handles it)
DROP POLICY IF EXISTS "Anon can call get_next_token" ON public.queue_tokens;
