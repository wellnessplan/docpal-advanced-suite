
-- Patient programs catalog (per clinic)
CREATE TABLE public.patient_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  emoji text DEFAULT '🦷',
  interval_months integer NOT NULL DEFAULT 3,
  message_template text NOT NULL,
  welcome_message text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_programs TO authenticated;
GRANT SELECT ON public.patient_programs TO anon;
GRANT ALL ON public.patient_programs TO service_role;
ALTER TABLE public.patient_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage own programs" ON public.patient_programs
  FOR ALL TO authenticated
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Public can read active programs" ON public.patient_programs
  FOR SELECT TO anon
  USING (active = true);
CREATE TRIGGER trg_patient_programs_updated
  BEFORE UPDATE ON public.patient_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patient enrollments in programs
CREATE TABLE public.program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.patient_programs(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  source text NOT NULL DEFAULT 'public_qr',
  status text NOT NULL DEFAULT 'active',
  next_reminder_at date NOT NULL,
  last_reminder_at timestamptz,
  reminders_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_enrollments TO authenticated;
GRANT ALL ON public.program_enrollments TO service_role;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage own enrollments" ON public.program_enrollments
  FOR ALL TO authenticated
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE INDEX idx_program_enrollments_due
  ON public.program_enrollments (clinic_id, next_reminder_at)
  WHERE status = 'active';
CREATE TRIGGER trg_program_enrollments_updated
  BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default programs for a clinic (idempotent)
CREATE OR REPLACE FUNCTION public.seed_default_patient_programs(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_clinic_id IS DISTINCT FROM public.get_user_clinic_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.patient_programs (clinic_id, code, name, description, emoji, interval_months, message_template, welcome_message)
  VALUES
    (p_clinic_id, 'change-brush', 'Change Your Brush',
     'Friendly reminder every 3 months to replace your toothbrush.',
     '🪥', 3,
     'Hi {{name}}, friendly reminder from your dentist: it''s time to replace your toothbrush! A fresh brush = healthier gums. Reply STOP to opt out.',
     'Hi {{name}}, you''re subscribed to "Change Your Brush" reminders. We''ll nudge you every 3 months. 🪥'),
    (p_clinic_id, 'monthly-tips', 'Monthly Dental Tips',
     'One curated dental health tip every month.',
     '💡', 1,
     'Hi {{name}}, here''s your monthly dental tip from us: Brush for 2 minutes, twice a day, and don''t forget to floss! Reply STOP to opt out.',
     'Hi {{name}}, you''re subscribed to Monthly Dental Tips. Expect one helpful message each month. 💡'),
    (p_clinic_id, 'kids-care', 'Kids Dental Care',
     'Pediatric checkup and brushing-habit reminders every 6 months.',
     '🧒', 6,
     'Hi {{name}}, time for your child''s 6-monthly dental check-up. Early visits = lifelong healthy smiles. Reply STOP to opt out.',
     'Hi {{name}}, you''re subscribed to Kids Dental Care reminders. We''ll message every 6 months. 🧒'),
    (p_clinic_id, 'senior-care', 'Senior Oral Care',
     'Denture care and gum-check reminders every 6 months for 60+ patients.',
     '👴', 6,
     'Hi {{name}}, gentle reminder for your 6-monthly oral health and denture check-up. Healthy gums at every age! Reply STOP to opt out.',
     'Hi {{name}}, you''re subscribed to Senior Oral Care reminders. We''ll message every 6 months. 👴')
  ON CONFLICT (clinic_id, code) DO NOTHING;
END;
$$;

-- Public list of active programs for landing page
CREATE OR REPLACE FUNCTION public.get_public_programs(p_clinic_id uuid)
RETURNS TABLE (id uuid, code text, name text, description text, emoji text, interval_months integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, name, description, emoji, interval_months
  FROM public.patient_programs
  WHERE clinic_id = p_clinic_id AND active = true
  ORDER BY interval_months, name;
$$;

-- Public enrollment RPC
CREATE OR REPLACE FUNCTION public.enroll_in_programs_public(
  p_clinic_id uuid,
  p_program_ids uuid[],
  p_full_name text,
  p_phone text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_full_name,''));
  v_phone text := nullif(btrim(coalesce(p_phone,'')), '');
  v_clinic_name text;
  v_patient_id uuid;
  v_program record;
  v_enrolled int := 0;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_msg text;
BEGIN
  IF v_name = '' OR length(v_name) > 200 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF p_program_ids IS NULL OR array_length(p_program_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one program';
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = p_clinic_id;
  IF v_clinic_name IS NULL THEN RAISE EXCEPTION 'Invalid clinic'; END IF;

  -- Link to existing patient if phone matches
  SELECT id INTO v_patient_id FROM public.patients
    WHERE clinic_id = p_clinic_id AND phone = v_phone
    ORDER BY created_at ASC LIMIT 1;

  FOR v_program IN
    SELECT * FROM public.patient_programs
    WHERE id = ANY(p_program_ids) AND clinic_id = p_clinic_id AND active = true
  LOOP
    INSERT INTO public.program_enrollments (
      clinic_id, program_id, patient_id, full_name, phone, source, status, next_reminder_at
    ) VALUES (
      p_clinic_id, v_program.id, v_patient_id, v_name, v_phone, 'public_qr', 'active',
      v_today + (v_program.interval_months || ' months')::interval
    )
    ON CONFLICT (program_id, phone) DO UPDATE
      SET status = 'active',
          full_name = EXCLUDED.full_name,
          patient_id = COALESCE(public.program_enrollments.patient_id, EXCLUDED.patient_id),
          updated_at = now();

    v_msg := replace(COALESCE(v_program.welcome_message, 'Hi {{name}}, you are subscribed.'), '{{name}}', v_name);
    INSERT INTO public.whatsapp_logs (
      clinic_id, patient_id, template_name, phone, message_body, status, delivery_status
    ) VALUES (
      p_clinic_id, v_patient_id, 'program_welcome', v_phone, v_msg, 'queued', 'queued'
    );

    v_enrolled := v_enrolled + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'enrolled', v_enrolled);
END;
$$;

-- Cron worker: send due program reminders (called by edge function or directly by pg_cron)
CREATE OR REPLACE FUNCTION public.dispatch_program_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_msg text;
  v_count int := 0;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  FOR rec IN
    SELECT e.id, e.clinic_id, e.patient_id, e.full_name, e.phone, p.message_template, p.interval_months, p.name AS program_name
    FROM public.program_enrollments e
    JOIN public.patient_programs p ON p.id = e.program_id
    WHERE e.status = 'active'
      AND p.active = true
      AND e.next_reminder_at <= v_today
  LOOP
    v_msg := replace(rec.message_template, '{{name}}', rec.full_name);
    INSERT INTO public.whatsapp_logs (
      clinic_id, patient_id, template_name, phone, message_body, status, delivery_status
    ) VALUES (
      rec.clinic_id, rec.patient_id, 'program_reminder', rec.phone, v_msg, 'queued', 'queued'
    );
    UPDATE public.program_enrollments
      SET last_reminder_at = now(),
          reminders_sent = reminders_sent + 1,
          next_reminder_at = v_today + (rec.interval_months || ' months')::interval,
          updated_at = now()
      WHERE id = rec.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'sent', v_count);
END;
$$;
