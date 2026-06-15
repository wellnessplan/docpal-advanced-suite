
-- 1. Track program_id on every WhatsApp send so we can aggregate engagement per program
ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.patient_programs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_program ON public.whatsapp_logs(program_id, sent_at);

-- 2. Per-program send rules and timezone
ALTER TABLE public.patient_programs
  ADD COLUMN IF NOT EXISTS send_rule text NOT NULL DEFAULT 'day_of_month',
  ADD COLUMN IF NOT EXISTS send_day_of_month integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS send_weekday integer,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

-- 3. Engagement dashboard view — sends, delivered, read, replied, failed per program per month
CREATE OR REPLACE VIEW public.engagement_program_dashboard AS
SELECT
  w.clinic_id,
  w.program_id,
  p.name AS program_name,
  p.emoji,
  date_trunc('month', COALESCE(w.sent_at, w.created_at)) AS month,
  count(*) FILTER (WHERE w.template_name LIKE 'program_%') AS total_sent,
  count(*) FILTER (WHERE w.delivery_status = 'delivered') AS delivered,
  count(*) FILTER (WHERE w.delivery_status = 'read') AS read_count,
  count(*) FILTER (WHERE w.delivery_status = 'replied') AS replied,
  count(*) FILTER (WHERE w.delivery_status = 'failed') AS failed
FROM public.whatsapp_logs w
LEFT JOIN public.patient_programs p ON p.id = w.program_id
WHERE w.template_name LIKE 'program_%'
GROUP BY w.clinic_id, w.program_id, p.name, p.emoji, date_trunc('month', COALESCE(w.sent_at, w.created_at));
GRANT SELECT ON public.engagement_program_dashboard TO authenticated;

-- 4. Updated dispatcher: stamps program_id on every send
CREATE OR REPLACE FUNCTION public.dispatch_program_reminders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec record; content_rec record; v_msg text;
  v_reminders int := 0; v_campaigns int := 0; v_recipients int;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  FOR rec IN
    SELECT e.id, e.clinic_id, e.patient_id, e.full_name, e.phone,
           p.id AS program_id, p.message_template, p.interval_months
    FROM public.program_enrollments e
    JOIN public.patient_programs p ON p.id = e.program_id
    WHERE e.status = 'active' AND e.opted_out_at IS NULL
      AND (e.pause_until IS NULL OR e.pause_until <= v_today)
      AND p.active = true AND e.next_reminder_at <= v_today
  LOOP
    v_msg := replace(rec.message_template, '{{name}}', rec.full_name);
    INSERT INTO public.whatsapp_logs (
      clinic_id, patient_id, program_id, template_name, phone, message_body, status, delivery_status, sent_at
    ) VALUES (
      rec.clinic_id, rec.patient_id, rec.program_id, 'program_reminder', rec.phone, v_msg, 'queued', 'queued', now()
    );
    UPDATE public.program_enrollments
      SET last_reminder_at = now(), reminders_sent = reminders_sent + 1,
          next_reminder_at = v_today + (rec.interval_months || ' months')::interval, updated_at = now()
      WHERE id = rec.id;
    v_reminders := v_reminders + 1;
  END LOOP;

  FOR content_rec IN
    SELECT id, clinic_id, program_id, title, body
    FROM public.program_content
    WHERE status = 'scheduled' AND scheduled_for <= v_today AND program_id IS NOT NULL
  LOOP
    v_recipients := 0;
    FOR rec IN
      SELECT e.id, e.patient_id, e.full_name, e.phone
      FROM public.program_enrollments e
      WHERE e.program_id = content_rec.program_id AND e.clinic_id = content_rec.clinic_id
        AND e.status = 'active' AND e.opted_out_at IS NULL
        AND (e.pause_until IS NULL OR e.pause_until <= v_today)
    LOOP
      v_msg := replace(content_rec.body, '{{name}}', rec.full_name);
      INSERT INTO public.whatsapp_logs (
        clinic_id, patient_id, program_id, template_name, phone, message_body, status, delivery_status, sent_at
      ) VALUES (
        content_rec.clinic_id, rec.patient_id, content_rec.program_id, 'program_campaign', rec.phone, v_msg, 'queued', 'queued', now()
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

-- 5. Send a test of a scheduled post to a staff phone (does NOT mark the post as sent)
CREATE OR REPLACE FUNCTION public.send_program_content_test(
  p_content_id uuid, p_test_phone text, p_test_name text DEFAULT 'Test User'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_content public.program_content%ROWTYPE;
  v_clinic_name text; v_prog_name text;
  v_msg text;
BEGIN
  SELECT * INTO v_content FROM public.program_content WHERE id = p_content_id;
  IF v_content.id IS NULL THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF v_content.clinic_id IS DISTINCT FROM public.get_user_clinic_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = v_content.clinic_id;
  SELECT name INTO v_prog_name FROM public.patient_programs WHERE id = v_content.program_id;

  v_msg := v_content.body;
  v_msg := replace(v_msg, '{{name}}', COALESCE(p_test_name, 'Test User'));
  v_msg := replace(v_msg, '{{program}}', COALESCE(v_prog_name, ''));
  v_msg := replace(v_msg, '{{clinic}}', COALESCE(v_clinic_name, ''));
  v_msg := replace(v_msg, '{{next_date}}', to_char((now() + interval '3 months')::date, 'DD Mon YYYY'));
  v_msg := '[TEST] ' || v_msg;

  INSERT INTO public.whatsapp_logs (
    clinic_id, program_id, template_name, phone, message_body, status, delivery_status, sent_at
  ) VALUES (
    v_content.clinic_id, v_content.program_id, 'program_test', p_test_phone, v_msg, 'queued', 'queued', now()
  );
  RETURN jsonb_build_object('success', true, 'preview', v_msg);
END;
$$;

-- 6. Compute next scheduled send date for a program based on its send_rule
CREATE OR REPLACE FUNCTION public.compute_next_program_send_date(p_program_id uuid)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.patient_programs%ROWTYPE;
  v_today date; v_d date; i int;
BEGIN
  SELECT * INTO p FROM public.patient_programs WHERE id = p_program_id;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  v_today := (now() AT TIME ZONE COALESCE(p.timezone, 'Asia/Kolkata'))::date;

  IF p.send_rule = 'weekday' AND p.send_weekday IS NOT NULL THEN
    FOR i IN 1..14 LOOP
      v_d := v_today + (i || ' days')::interval;
      IF extract(dow FROM v_d)::int = p.send_weekday THEN RETURN v_d; END IF;
    END LOOP;
    RETURN v_today + interval '7 days';
  ELSE
    v_d := date_trunc('month', v_today)::date
           + ((LEAST(COALESCE(p.send_day_of_month, 1), 28) - 1) || ' days')::interval;
    IF v_d <= v_today THEN
      v_d := (date_trunc('month', v_today) + interval '1 month')::date
             + ((LEAST(COALESCE(p.send_day_of_month, 1), 28) - 1) || ' days')::interval;
    END IF;
    RETURN v_d;
  END IF;
END;
$$;

-- 7. Bulk enrollment from CSV/Excel (staff console)
CREATE OR REPLACE FUNCTION public.bulk_enroll_program(
  p_program_id uuid,
  p_rows jsonb  -- [{full_name, phone}, ...]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic uuid := public.get_user_clinic_id();
  v_prog public.patient_programs%ROWTYPE;
  v_row jsonb; v_name text; v_phone text;
  v_patient_id uuid; v_msg text;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_added int := 0; v_skipped int := 0;
BEGIN
  SELECT * INTO v_prog FROM public.patient_programs WHERE id = p_program_id;
  IF v_prog.clinic_id IS DISTINCT FROM v_clinic THEN RAISE EXCEPTION 'Access denied'; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_name := btrim(coalesce(v_row->>'full_name',''));
    v_phone := regexp_replace(coalesce(v_row->>'phone',''), '\D', '', 'g');
    IF v_name = '' OR length(v_phone) < 10 THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

    SELECT id INTO v_patient_id FROM public.patients
      WHERE clinic_id = v_clinic AND phone = v_phone
      ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.program_enrollments (
      clinic_id, program_id, patient_id, full_name, phone, source, status, next_reminder_at
    ) VALUES (
      v_clinic, p_program_id, v_patient_id, v_name, v_phone, 'bulk_import', 'active',
      v_today + (v_prog.interval_months || ' months')::interval
    )
    ON CONFLICT (program_id, phone) DO UPDATE
      SET status = 'active', full_name = EXCLUDED.full_name, updated_at = now();

    v_msg := replace(COALESCE(v_prog.welcome_message, 'Hi {{name}}, you are subscribed.'), '{{name}}', v_name);
    INSERT INTO public.whatsapp_logs (
      clinic_id, patient_id, program_id, template_name, phone, message_body, status, delivery_status, sent_at
    ) VALUES (
      v_clinic, v_patient_id, p_program_id, 'program_welcome', v_phone, v_msg, 'queued', 'queued', now()
    );
    v_added := v_added + 1;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped);
END;
$$;
