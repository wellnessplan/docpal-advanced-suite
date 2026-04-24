-- 1. Outgoing emails queue
CREATE TABLE public.outgoing_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  template_key text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  template_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.outgoing_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view own clinic emails"
  ON public.outgoing_emails FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id() OR is_super_admin());

CREATE POLICY "Authenticated can insert emails"
  ON public.outgoing_emails FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Super admin manages emails"
  ON public.outgoing_emails FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_outgoing_emails_clinic ON public.outgoing_emails(clinic_id, created_at DESC);
CREATE INDEX idx_outgoing_emails_status ON public.outgoing_emails(status, created_at);

-- 2. Patient consent fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS data_consent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_export_requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_deletion_requested_at timestamp with time zone;

-- 3. Clinic onboarding progress
CREATE TABLE public.clinic_onboarding (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  profile_completed boolean NOT NULL DEFAULT false,
  first_patient_added boolean NOT NULL DEFAULT false,
  first_appointment_booked boolean NOT NULL DEFAULT false,
  first_invoice_created boolean NOT NULL DEFAULT false,
  demo_data_loaded boolean NOT NULL DEFAULT false,
  tour_completed boolean NOT NULL DEFAULT false,
  checklist_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view own onboarding"
  ON public.clinic_onboarding FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff insert own onboarding"
  ON public.clinic_onboarding FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff update own onboarding"
  ON public.clinic_onboarding FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE TRIGGER update_clinic_onboarding_updated_at
  BEFORE UPDATE ON public.clinic_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Error logs
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id uuid,
  source text NOT NULL DEFAULT 'frontend',
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  context jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view own errors"
  ON public.error_logs FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id() OR is_super_admin());

CREATE POLICY "Anyone authenticated can log errors"
  ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can log errors"
  ON public.error_logs FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Super admin updates errors"
  ON public.error_logs FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_error_logs_clinic ON public.error_logs(clinic_id, created_at DESC);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved, created_at DESC);

-- 5. RPC: bulk delete patient data (GDPR right to erasure)
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

  -- Cascade delete patient data (preserves audit trail by anonymizing instead)
  UPDATE public.patients
  SET
    full_name = 'DELETED PATIENT',
    phone = NULL,
    email = NULL,
    address = NULL,
    date_of_birth = NULL,
    medical_history = NULL,
    allergies = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    data_deletion_requested_at = now()
  WHERE id = p_patient_id;

  INSERT INTO public.audit_log (clinic_id, user_id, action, table_name, record_id, details)
  VALUES (v_clinic_id, auth.uid(), 'gdpr_delete', 'patients', p_patient_id,
    jsonb_build_object('reason', 'GDPR right to erasure'));
END;
$$;

-- 6. RPC: load demo data
CREATE OR REPLACE FUNCTION public.load_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public.get_user_clinic_id();
  v_patient_id uuid;
  v_invoice_id uuid;
  v_count integer := 0;
  v_first_names text[] := ARRAY['Aarav','Diya','Vivaan','Saanvi','Aditya','Anaya','Arjun','Myra','Reyansh','Ira','Vihaan','Kiara','Ayaan','Pari','Sai','Aadhya','Krishna','Riya','Ishaan','Anika'];
  v_last_names text[] := ARRAY['Sharma','Patel','Singh','Kumar','Gupta','Mehta','Shah','Reddy','Nair','Iyer','Kapoor','Malhotra','Joshi','Verma','Agarwal','Rao','Pillai','Khan','Desai','Bose'];
  v_treatments text[] := ARRAY['Scaling & Polishing','Composite Filling','Root Canal Treatment','Crown Preparation','Tooth Extraction','Teeth Whitening','Dental Implant','Orthodontic Consultation'];
  i integer;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'No clinic context';
  END IF;

  FOR i IN 1..20 LOOP
    INSERT INTO public.patients (
      clinic_id, full_name, phone, email,
      date_of_birth, gender, address
    ) VALUES (
      v_clinic_id,
      v_first_names[((i-1) % 20) + 1] || ' ' || v_last_names[((i*7) % 20) + 1],
      '+91 ' || (90000 + (i * 137))::text || (10000 + (i * 211))::text,
      lower(v_first_names[((i-1) % 20) + 1]) || '.demo' || i || '@example.com',
      (CURRENT_DATE - (i * 365 + 7000))::date,
      CASE WHEN i % 2 = 0 THEN 'male' ELSE 'female' END,
      i || ' Demo Street, Sample City'
    ) RETURNING id INTO v_patient_id;
    v_count := v_count + 1;

    -- Add appointment for ~70%
    IF i % 3 != 0 THEN
      INSERT INTO public.appointments (
        clinic_id, patient_id, appointment_date, appointment_time, status, type, notes
      ) VALUES (
        v_clinic_id, v_patient_id,
        CURRENT_DATE + (i % 14 - 7),
        ((9 + (i % 8))::text || ':' || CASE WHEN i % 2 = 0 THEN '00' ELSE '30' END)::time,
        CASE
          WHEN i % 5 = 0 THEN 'completed'
          WHEN i % 5 = 1 THEN 'scheduled'
          WHEN i % 5 = 2 THEN 'checked_in'
          ELSE 'scheduled'
        END,
        v_treatments[((i-1) % 8) + 1],
        'Demo appointment'
      );
    END IF;

    -- Add invoice for ~50%
    IF i % 2 = 0 THEN
      INSERT INTO public.invoices (
        clinic_id, patient_id, total, subtotal, paid_amount, status,
        invoice_date, payment_method, notes
      ) VALUES (
        v_clinic_id, v_patient_id,
        (1000 + (i * 350))::numeric,
        (1000 + (i * 350))::numeric,
        CASE WHEN i % 4 = 0 THEN (1000 + (i * 350))::numeric ELSE 0 END,
        CASE WHEN i % 4 = 0 THEN 'paid' ELSE 'unpaid' END,
        CURRENT_DATE - (i % 30),
        CASE WHEN i % 4 = 0 THEN 'cash' ELSE NULL END,
        'Demo invoice'
      ) RETURNING id INTO v_invoice_id;

      INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total)
      VALUES (v_invoice_id, v_treatments[((i-1) % 8) + 1], 1, (1000 + (i * 350))::numeric, (1000 + (i * 350))::numeric);
    END IF;
  END LOOP;

  -- Mark onboarding
  INSERT INTO public.clinic_onboarding (clinic_id, demo_data_loaded, first_patient_added, first_appointment_booked, first_invoice_created)
  VALUES (v_clinic_id, true, true, true, true)
  ON CONFLICT (clinic_id) DO UPDATE SET
    demo_data_loaded = true,
    first_patient_added = true,
    first_appointment_booked = true,
    first_invoice_created = true,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'patients_created', v_count);
END;
$$;

-- 7. RPC: clear demo data
CREATE OR REPLACE FUNCTION public.clear_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public.get_user_clinic_id();
  v_deleted integer;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'No clinic context';
  END IF;

  DELETE FROM public.invoice_items WHERE invoice_id IN (
    SELECT id FROM public.invoices WHERE clinic_id = v_clinic_id AND notes = 'Demo invoice'
  );
  DELETE FROM public.invoices WHERE clinic_id = v_clinic_id AND notes = 'Demo invoice';
  DELETE FROM public.appointments WHERE clinic_id = v_clinic_id AND notes = 'Demo appointment';
  DELETE FROM public.patients WHERE clinic_id = v_clinic_id AND email LIKE '%.demo%@example.com'
  RETURNING 1 INTO v_deleted;

  UPDATE public.clinic_onboarding SET demo_data_loaded = false, updated_at = now()
  WHERE clinic_id = v_clinic_id;

  RETURN jsonb_build_object('success', true);
END;
$$;