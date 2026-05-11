CREATE OR REPLACE FUNCTION public.self_register_patient(
  p_clinic_id uuid,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_dob date DEFAULT NULL,
  p_appointment_date date DEFAULT NULL,
  p_appointment_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_op_number text;
  v_token int;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_reused boolean := false;
  v_name text := btrim(coalesce(p_full_name,''));
  v_phone text := nullif(btrim(coalesce(p_phone,'')), '');
BEGIN
  IF v_name = '' OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'Invalid clinic';
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id, op_number INTO v_patient_id, v_op_number
    FROM public.patients
    WHERE clinic_id = p_clinic_id AND phone = v_phone
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
      v_reused := true;
    END IF;
  END IF;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (clinic_id, full_name, phone, email, date_of_birth)
    VALUES (p_clinic_id, v_name, v_phone, nullif(btrim(coalesce(p_email,'')),''), p_dob)
    RETURNING id, op_number INTO v_patient_id, v_op_number;
  END IF;

  IF p_appointment_date IS NOT NULL AND p_appointment_time IS NOT NULL THEN
    BEGIN
      INSERT INTO public.appointments (
        clinic_id, patient_id, appointment_date, appointment_time,
        status, type, duration_minutes
      ) VALUES (
        p_clinic_id, v_patient_id, p_appointment_date, p_appointment_time,
        'scheduled', 'checkup', 30
      );
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  v_token := public.get_next_token_number(p_clinic_id, v_today);

  INSERT INTO public.queue_tokens (
    clinic_id, patient_id, token_number, queue_date, status, priority
  ) VALUES (
    p_clinic_id, v_patient_id, v_token, v_today, 'waiting', 'normal'
  );

  RETURN jsonb_build_object(
    'patient_id', v_patient_id,
    'op_number', v_op_number,
    'token_number', v_token,
    'reused', v_reused
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_register_patient(
  uuid, text, text, text, date, date, time
) TO anon, authenticated;