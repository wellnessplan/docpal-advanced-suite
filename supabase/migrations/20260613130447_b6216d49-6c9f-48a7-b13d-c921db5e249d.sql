
-- Allow super admins to create clinics; also add safe RPC for admin-driven clinic creation
CREATE POLICY "Super admins can view all clinics"
  ON public.clinics FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins can update all clinics"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.admin_create_clinic(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_trial_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_clinic_id uuid;
  v_trial_end timestamptz;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can create clinics';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Clinic name required';
  END IF;

  INSERT INTO public.clinic_groups (name, owner_user_id)
  VALUES (p_name || ' Group', auth.uid())
  RETURNING id INTO v_group_id;

  INSERT INTO public.clinics (name, email, phone, group_id)
  VALUES (p_name, p_email, p_phone, v_group_id)
  RETURNING id INTO v_clinic_id;

  v_trial_end := now() + (COALESCE(p_trial_days, 14) || ' days')::interval;

  INSERT INTO public.clinic_subscriptions (clinic_id, status, trial_ends_at, plan_name)
  VALUES (v_clinic_id, 'trial', v_trial_end, 'basic')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'id', v_clinic_id,
    'name', p_name,
    'email', p_email,
    'phone', p_phone,
    'group_id', v_group_id,
    'trial_ends_at', v_trial_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_clinic(text, text, text, integer) TO authenticated;

-- Allow all authenticated users to view active subscription plans (so trial users can see upgrade options)
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Authenticated users can view active plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);
