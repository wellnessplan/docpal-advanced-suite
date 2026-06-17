
ALTER TABLE public.clinic_registration_settings
  ADD COLUMN IF NOT EXISTS require_phone_verification boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.request_patient_otp(p_clinic_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_code text;
  v_hash text;
  v_clinic_name text;
  v_recent int;
BEGIN
  IF length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Invalid phone';
  END IF;
  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = p_clinic_id;
  IF v_clinic_name IS NULL THEN RAISE EXCEPTION 'Invalid clinic'; END IF;

  SELECT count(*) INTO v_recent FROM public.patient_otp_codes
   WHERE clinic_id = p_clinic_id AND phone = v_phone
     AND created_at > now() - interval '10 minutes';
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Too many OTP requests. Please wait a few minutes.';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_hash := encode(extensions.digest(v_code || '|' || p_clinic_id::text || '|' || v_phone, 'sha256'), 'hex');

  INSERT INTO public.patient_otp_codes (clinic_id, phone, code_hash, expires_at, attempts)
  VALUES (p_clinic_id, v_phone, v_hash, now() + interval '10 minutes', 0);

  INSERT INTO public.whatsapp_logs (clinic_id, template_name, phone, message_body, status, delivery_status)
  VALUES (p_clinic_id, 'otp_verification', v_phone,
    'Your ' || v_clinic_name || ' verification code is ' || v_code || '. Valid for 10 minutes.',
    'queued', 'queued');

  RETURN jsonb_build_object('success', true, 'expires_in_seconds', 600);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_patient_otp(p_clinic_id uuid, p_phone text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_hash text;
  v_row public.patient_otp_codes%ROWTYPE;
BEGIN
  v_hash := encode(extensions.digest(coalesce(p_code,'') || '|' || p_clinic_id::text || '|' || v_phone, 'sha256'), 'hex');
  SELECT * INTO v_row FROM public.patient_otp_codes
   WHERE clinic_id = p_clinic_id AND phone = v_phone AND used_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('verified', false, 'reason', 'no_code'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('verified', false, 'reason', 'expired'); END IF;
  IF v_row.attempts >= 5 THEN RETURN jsonb_build_object('verified', false, 'reason', 'locked'); END IF;
  IF v_row.code_hash <> v_hash THEN
    UPDATE public.patient_otp_codes SET attempts = attempts + 1 WHERE id = v_row.id;
    RETURN jsonb_build_object('verified', false, 'reason', 'bad_code');
  END IF;
  UPDATE public.patient_otp_codes SET used_at = now() WHERE id = v_row.id;
  RETURN jsonb_build_object('verified', true);
END;
$$;
