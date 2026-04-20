
-- 1) Doctor push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND clinic_id = public.get_user_clinic_id());

CREATE TRIGGER push_subs_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_push_subs_clinic ON public.push_subscriptions(clinic_id) WHERE enabled = true;

-- 2) Patient OTP codes (for portal login)
CREATE TABLE public.patient_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_otp_codes ENABLE ROW LEVEL SECURITY;
-- No client policies — only edge functions (service role) access this.

CREATE INDEX idx_otp_phone_clinic ON public.patient_otp_codes(clinic_id, phone, expires_at DESC);

-- 3) Patient portal sessions
CREATE TABLE public.patient_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;
-- No client policies — only edge functions (service role) access this.

CREATE INDEX idx_patient_sessions_token ON public.patient_sessions(token_hash);
CREATE INDEX idx_patient_sessions_patient ON public.patient_sessions(patient_id);

-- 4) Trigger: when new appointment inserted, async call edge function to send push
CREATE OR REPLACE FUNCTION public.notify_doctor_push_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://nzfeoecmuhoblndzalll.supabase.co/functions/v1/send-doctor-push';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZmVvZWNtdWhvYmxuZHphbGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODc2MDAsImV4cCI6MjA5MTY2MzYwMH0.YV3STKIcIgiuRTpTx2ubTiAgtTTYj0GLN6VYGFPg7co';
BEGIN
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon),
    body := jsonb_build_object(
      'event','new_appointment',
      'clinic_id', NEW.clinic_id,
      'appointment_id', NEW.id,
      'patient_id', NEW.patient_id,
      'doctor_id', NEW.doctor_id,
      'appointment_date', NEW.appointment_date,
      'appointment_time', NEW.appointment_time
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TRIGGER appointments_push_notify
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_doctor_push_on_appointment();

-- 5) RPC for patient portal: fetch a patient's data using session token (called from edge fn only)
-- We just rely on service role in edge functions, no extra RPC needed here.
