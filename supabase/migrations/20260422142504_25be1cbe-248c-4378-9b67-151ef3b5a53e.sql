
-- Automation rules per clinic
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  days_offset integer NOT NULL DEFAULT 0,
  default_duration_days integer NOT NULL DEFAULT 5,
  video_url text,
  cta_link text,
  message_body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, rule_key)
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members view automation rules"
  ON public.automation_rules FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic members manage automation rules"
  ON public.automation_rules FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER trg_automation_rules_updated
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger log (idempotency guard)
CREATE TABLE public.automation_trigger_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  patient_id uuid,
  reference_id uuid,
  reference_type text,
  fired_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, rule_key, patient_id, reference_id, fired_on)
);

ALTER TABLE public.automation_trigger_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members view automation log"
  ON public.automation_trigger_log FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE INDEX idx_auto_log_lookup
  ON public.automation_trigger_log (clinic_id, rule_key, patient_id, reference_id);

-- Seed defaults for existing clinics
INSERT INTO public.automation_rules (clinic_id, rule_key, enabled, days_offset, default_duration_days, message_body)
SELECT c.id, v.rule_key, true, v.days_offset, 5, v.message_body
FROM public.clinics c
CROSS JOIN (VALUES
  ('post_treatment_instant', 0,
    'Hello {{patient_name}}, your treatment ({{treatment}}) is complete. Your prescription: {{rx_link}}. Post-op care: {{video_url}}. Call us if you have any concerns. - {{clinic_name}}'),
  ('treatment_not_accepted', 3,
    'Hi {{patient_name}}, just a reminder about your pending treatment ({{treatment}}). Watch this short video to learn more: {{video_url}}. Reply YES to schedule. - {{clinic_name}}'),
  ('daily_medicine_reminder', 1,
    'Hello {{patient_name}}, gentle reminder to take your prescribed medicines today. Day {{day}} of {{total_days}}. Stay well! - {{clinic_name}}'),
  ('post_med_review_referral', 3,
    'Hi {{patient_name}}, hope you''re feeling great! If you had a good experience, please leave us a review: {{review_link}}. Refer a friend & get rewarded! - {{clinic_name}}')
) AS v(rule_key, days_offset, message_body)
ON CONFLICT (clinic_id, rule_key) DO NOTHING;
