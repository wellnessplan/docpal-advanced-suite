-- Track WhatsApp provider message id and live delivery status on whatsapp_logs
ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_provider_msg
  ON public.whatsapp_logs (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Extend self_register_patient to queue a registration-confirmation WhatsApp log
CREATE OR REPLACE FUNCTION public.self_register_patient(
  p_clinic_id uuid,
  p_full_name text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_dob date DEFAULT NULL::date,
  p_appointment_date date DEFAULT NULL::date,
  p_appointment_time time without time zone DEFAULT NULL::time without time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_patient_id uuid;
  v_op_number text;
  v_token int;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_reused boolean := false;
  v_name text := btrim(coalesce(p_full_name,''));
  v_phone text := nullif(btrim(coalesce(p_phone,'')), '');
  v_clinic_name text;
BEGIN
  IF v_name = '' OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = p_clinic_id;
  IF v_clinic_name IS NULL THEN
    RAISE EXCEPTION 'Invalid clinic';
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id, op_number INTO v_patient_id, v_op_number
    FROM public.patients
    WHERE clinic_id = p_clinic_id AND phone = v_phone
    ORDER BY created_at ASC LIMIT 1;
    IF v_patient_id IS NOT NULL THEN v_reused := true; END IF;
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

  -- Queue WhatsApp registration confirmation (delivery webhook will update status)
  IF v_phone IS NOT NULL THEN
    INSERT INTO public.whatsapp_logs (
      clinic_id, patient_id, template_name, phone, message_body, status, delivery_status
    ) VALUES (
      p_clinic_id, v_patient_id, 'registration_confirmation', v_phone,
      'Hi ' || v_name || ', you are registered at ' || v_clinic_name ||
      '. Your token number is ' || v_token::text ||
      CASE WHEN v_reused THEN ' (UHID ' || v_op_number || ').' ELSE '.' END,
      'queued', 'queued'
    );
  END IF;

  RETURN jsonb_build_object(
    'patient_id', v_patient_id,
    'op_number', v_op_number,
    'token_number', v_token,
    'reused', v_reused
  );
END;
$function$;