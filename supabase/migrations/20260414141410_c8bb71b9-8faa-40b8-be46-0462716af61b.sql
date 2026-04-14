
-- Fix clinic_settings: drop restrictive policies and add permissive ones
DROP POLICY IF EXISTS "Clinic staff can view settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Clinic staff can insert settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Clinic staff can update settings" ON public.clinic_settings;

CREATE POLICY "Anyone can view clinic settings" ON public.clinic_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clinic settings" ON public.clinic_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clinic settings" ON public.clinic_settings FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clinic settings" ON public.clinic_settings FOR DELETE USING (true);

-- Fix queue_tokens: drop restrictive policies and add permissive ones
DROP POLICY IF EXISTS "Clinic staff can view queue" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can insert queue" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can update queue" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can delete queue" ON public.queue_tokens;

CREATE POLICY "Anyone can view queue tokens" ON public.queue_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can insert queue tokens" ON public.queue_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update queue tokens" ON public.queue_tokens FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete queue tokens" ON public.queue_tokens FOR DELETE USING (true);

-- Fix daily_todos: drop and re-add permissive policies
DROP POLICY IF EXISTS "Clinic staff can view daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Clinic staff can insert daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Clinic staff can update daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Clinic staff can delete daily_todos" ON public.daily_todos;

CREATE POLICY "Anyone can view daily_todos" ON public.daily_todos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert daily_todos" ON public.daily_todos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update daily_todos" ON public.daily_todos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete daily_todos" ON public.daily_todos FOR DELETE USING (true);

-- Create discount_coupons table
CREATE TABLE public.discount_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' or 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, code)
);

ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discount_coupons" ON public.discount_coupons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert discount_coupons" ON public.discount_coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update discount_coupons" ON public.discount_coupons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete discount_coupons" ON public.discount_coupons FOR DELETE USING (true);

CREATE TRIGGER update_discount_coupons_updated_at
  BEFORE UPDATE ON public.discount_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
