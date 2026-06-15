
-- 1. Add pause/opt-out to enrollments
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS pause_until date,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;

-- 2. Program content table (library + scheduled posts)
CREATE TABLE public.program_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.patient_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  is_template boolean NOT NULL DEFAULT false,
  scheduled_for date,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_content TO authenticated;
GRANT ALL ON public.program_content TO service_role;
ALTER TABLE public.program_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage program content" ON public.program_content
  FOR ALL TO authenticated
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE INDEX idx_program_content_due
  ON public.program_content (clinic_id, scheduled_for) WHERE status = 'scheduled';
CREATE TRIGGER trg_program_content_updated
  BEFORE UPDATE ON public.program_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Updated dispatcher: reminders + scheduled content, respects pause/opt-out
CREATE OR REPLACE FUNCTION public.dispatch_program_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  content_rec record;
  v_msg text;
  v_reminders int := 0;
  v_campaigns int := 0;
  v_recipients int;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- A) Recurring per-program reminders
  FOR rec IN
    SELECT e.id, e.clinic_id, e.patient_id, e.full_name, e.phone,
           p.message_template, p.interval_months
    FROM public.program_enrollments e
    JOIN public.patient_programs p ON p.id = e.program_id
    WHERE e.status = 'active'
      AND e.opted_out_at IS NULL
      AND (e.pause_until IS NULL OR e.pause_until <= v_today)
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
    v_reminders := v_reminders + 1;
  END LOOP;

  -- B) Scheduled campaign content (broadcast to all active enrollments of that program)
  FOR content_rec IN
    SELECT id, clinic_id, program_id, title, body
    FROM public.program_content
    WHERE status = 'scheduled' AND scheduled_for <= v_today AND program_id IS NOT NULL
  LOOP
    v_recipients := 0;
    FOR rec IN
      SELECT e.id, e.patient_id, e.full_name, e.phone
      FROM public.program_enrollments e
      WHERE e.program_id = content_rec.program_id
        AND e.clinic_id = content_rec.clinic_id
        AND e.status = 'active'
        AND e.opted_out_at IS NULL
        AND (e.pause_until IS NULL OR e.pause_until <= v_today)
    LOOP
      v_msg := replace(content_rec.body, '{{name}}', rec.full_name);
      INSERT INTO public.whatsapp_logs (
        clinic_id, patient_id, template_name, phone, message_body, status, delivery_status
      ) VALUES (
        content_rec.clinic_id, rec.patient_id, 'program_campaign', rec.phone, v_msg, 'queued', 'queued'
      );
      v_recipients := v_recipients + 1;
    END LOOP;
    UPDATE public.program_content
      SET status = 'sent', sent_at = now(), sent_count = v_recipients, updated_at = now()
      WHERE id = content_rec.id;
    v_campaigns := v_campaigns + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reminders', v_reminders, 'campaigns', v_campaigns);
END;
$$;

-- 4. Public RPCs: look up & manage own subscriptions by phone
CREATE OR REPLACE FUNCTION public.get_my_program_enrollments(p_clinic_id uuid, p_phone text)
RETURNS TABLE (
  enrollment_id uuid, program_name text, emoji text, interval_months integer,
  status text, pause_until date, opted_out_at timestamptz, next_reminder_at date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, p.name, p.emoji, p.interval_months,
         e.status, e.pause_until, e.opted_out_at, e.next_reminder_at
  FROM public.program_enrollments e
  JOIN public.patient_programs p ON p.id = e.program_id
  WHERE e.clinic_id = p_clinic_id AND e.phone = p_phone
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.update_my_program_enrollment(
  p_clinic_id uuid, p_phone text, p_enrollment_id uuid, p_action text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_rows int;
BEGIN
  IF p_action NOT IN ('pause_1m','pause_3m','resume','opt_out','resubscribe') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  UPDATE public.program_enrollments
  SET pause_until = CASE p_action
                      WHEN 'pause_1m' THEN v_today + interval '1 month'
                      WHEN 'pause_3m' THEN v_today + interval '3 months'
                      WHEN 'resume'   THEN NULL
                      WHEN 'resubscribe' THEN NULL
                      ELSE pause_until
                    END,
      opted_out_at = CASE p_action
                       WHEN 'opt_out' THEN now()
                       WHEN 'resubscribe' THEN NULL
                       ELSE opted_out_at
                     END,
      status = CASE p_action
                 WHEN 'opt_out' THEN 'opted_out'
                 WHEN 'resubscribe' THEN 'active'
                 ELSE status
               END,
      updated_at = now()
  WHERE id = p_enrollment_id AND clinic_id = p_clinic_id AND phone = p_phone;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
