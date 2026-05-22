
-- 1. subscription_plans catalog
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_inr numeric NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','yearly')),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_patients integer,
  max_doctors integer,
  max_branches integer,
  ai_monthly_cap_inr numeric DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (is_active = true OR public.is_super_admin());

CREATE POLICY "Super admins manage plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link clinic_subscriptions to catalog + AI cap
ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_monthly_cap_inr numeric DEFAULT 500;

-- 3. ai_usage_log
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) STORED,
  cost_inr numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_clinic_created ON public.ai_usage_log (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON public.ai_usage_log (created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all AI usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.get_user_clinic_id());

-- Writes happen via service role only (edge functions), no insert policy needed.

-- 4. Seed default plans
INSERT INTO public.subscription_plans (code, name, price_inr, billing_cycle, features, max_patients, max_doctors, max_branches, ai_monthly_cap_inr, sort_order)
VALUES
  ('basic',      'Basic',      999,  'monthly', '["Up to 500 patients","1 doctor","WhatsApp reminders"]'::jsonb, 500,  1,  1, 200,  10),
  ('pro',        'Pro',        2499, 'monthly', '["Up to 5,000 patients","5 doctors","Full automation","AI assistance"]'::jsonb, 5000, 5,  2, 1000, 20),
  ('enterprise', 'Enterprise', 5999, 'monthly', '["Unlimited patients","Unlimited doctors","Multi-branch","Priority support","Custom AI cap"]'::jsonb, NULL, NULL, NULL, 5000, 30)
ON CONFLICT (code) DO NOTHING;
