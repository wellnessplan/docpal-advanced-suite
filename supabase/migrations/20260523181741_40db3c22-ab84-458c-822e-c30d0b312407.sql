
-- Impersonation columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS impersonating_original_clinic_id uuid,
  ADD COLUMN IF NOT EXISTS impersonating_original_group_id uuid;

-- Start impersonation
CREATE OR REPLACE FUNCTION public.start_impersonation(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_group uuid;
  v_current_clinic uuid;
  v_current_group uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can impersonate';
  END IF;

  SELECT group_id INTO v_target_group FROM public.clinics WHERE id = p_clinic_id;
  IF v_target_group IS NULL THEN
    RAISE EXCEPTION 'Clinic not found';
  END IF;

  SELECT clinic_id, group_id, COALESCE(impersonating_original_clinic_id, clinic_id),
         COALESCE(impersonating_original_group_id, group_id)
    INTO v_current_clinic, v_current_group, v_current_clinic, v_current_group
  FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.profiles
  SET impersonating_original_clinic_id = COALESCE(impersonating_original_clinic_id, clinic_id),
      impersonating_original_group_id  = COALESCE(impersonating_original_group_id,  group_id),
      clinic_id = p_clinic_id,
      group_id  = v_target_group,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.platform_audit_log (actor_user_id, actor_name, action, target_type, target_id, target_label, details)
  SELECT auth.uid(),
         COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'super_admin'),
         'impersonation_started', 'clinic', p_clinic_id,
         (SELECT name FROM public.clinics WHERE id = p_clinic_id),
         jsonb_build_object('original_clinic_id', v_current_clinic);

  RETURN jsonb_build_object('success', true, 'clinic_id', p_clinic_id);
END;
$$;

-- End impersonation
CREATE OR REPLACE FUNCTION public.end_impersonation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_clinic uuid;
  v_orig_group  uuid;
  v_current_clinic uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can end impersonation';
  END IF;

  SELECT impersonating_original_clinic_id, impersonating_original_group_id, clinic_id
    INTO v_orig_clinic, v_orig_group, v_current_clinic
  FROM public.profiles WHERE user_id = auth.uid();

  IF v_orig_clinic IS NULL THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  UPDATE public.profiles
  SET clinic_id = v_orig_clinic,
      group_id  = v_orig_group,
      impersonating_original_clinic_id = NULL,
      impersonating_original_group_id  = NULL,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.platform_audit_log (actor_user_id, actor_name, action, target_type, target_id, target_label, details)
  SELECT auth.uid(),
         COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'super_admin'),
         'impersonation_ended', 'clinic', v_current_clinic,
         (SELECT name FROM public.clinics WHERE id = v_current_clinic),
         jsonb_build_object('restored_clinic_id', v_orig_clinic);

  RETURN jsonb_build_object('success', true, 'clinic_id', v_orig_clinic);
END;
$$;

-- AI spend helper for edge functions
CREATE OR REPLACE FUNCTION public.clinic_ai_spend_this_month(p_clinic_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_inr), 0)::numeric
  FROM public.ai_usage_log
  WHERE clinic_id = p_clinic_id
    AND created_at >= date_trunc('month', now());
$$;
