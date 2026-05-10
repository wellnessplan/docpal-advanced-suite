
-- 1. Prevent double-booking
CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_double_book
  ON public.appointments (clinic_id, doctor_id, appointment_date, appointment_time)
  WHERE status NOT IN ('cancelled','no_show') AND doctor_id IS NOT NULL;

-- 2. Edge function failure tracking (DLQ)
CREATE TABLE IF NOT EXISTS public.edge_function_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  payload jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 1,
  next_retry_at timestamptz NOT NULL DEFAULT now() + interval '1 minute',
  status text NOT NULL DEFAULT 'pending', -- pending | retrying | succeeded | dead
  clinic_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eff_retry ON public.edge_function_failures (status, next_retry_at) WHERE status IN ('pending','retrying');
ALTER TABLE public.edge_function_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic users read own failures" ON public.edge_function_failures
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());
CREATE POLICY "service writes failures" ON public.edge_function_failures
  FOR ALL USING (true) WITH CHECK (true);

-- 3. WhatsApp delivery status
CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL,
  status text NOT NULL,
  raw jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wds_msg ON public.whatsapp_delivery_status (provider_message_id);
ALTER TABLE public.whatsapp_delivery_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service all wds" ON public.whatsapp_delivery_status
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Add tracking columns to whatsapp_messages if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_messages') THEN
    EXECUTE 'ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS provider_message_id text';
    EXECUTE 'ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT ''queued''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wm_provider ON public.whatsapp_messages (provider_message_id)';
  END IF;
END $$;
