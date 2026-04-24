-- Fix GDPR delete to only reference real columns
CREATE OR REPLACE FUNCTION public.gdpr_delete_patient(p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.patients WHERE id = p_patient_id;
  IF v_clinic_id IS DISTINCT FROM public.get_user_clinic_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.patients
  SET
    full_name = 'DELETED PATIENT',
    phone = NULL,
    email = NULL,
    address = NULL,
    date_of_birth = NULL,
    age = NULL,
    medical_history = NULL,
    allergies = NULL,
    blood_group = NULL,
    notes = NULL,
    data_deletion_requested_at = now()
  WHERE id = p_patient_id;

  INSERT INTO public.audit_log (clinic_id, user_id, action, table_name, record_id, details)
  VALUES (v_clinic_id, auth.uid(), 'gdpr_delete', 'patients', p_patient_id,
    jsonb_build_object('reason', 'GDPR right to erasure'));
END;
$$;

-- Tighten RLS: outgoing_emails insert restricted to user's own clinic
DROP POLICY IF EXISTS "Authenticated can insert emails" ON public.outgoing_emails;
CREATE POLICY "Clinic staff insert own emails"
  ON public.outgoing_emails FOR INSERT TO authenticated
  WITH CHECK (clinic_id IS NULL OR clinic_id = get_user_clinic_id());

-- Tighten RLS: error_logs scope to clinic when set, allow null clinic for anonymous errors
DROP POLICY IF EXISTS "Anyone authenticated can log errors" ON public.error_logs;
DROP POLICY IF EXISTS "Anonymous can log errors" ON public.error_logs;
CREATE POLICY "Authenticated insert errors for own clinic"
  ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (clinic_id IS NULL OR clinic_id = get_user_clinic_id());
CREATE POLICY "Anonymous insert errors without clinic"
  ON public.error_logs FOR INSERT TO anon
  WITH CHECK (clinic_id IS NULL);