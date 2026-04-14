-- Subscription tracking for clinics
CREATE TABLE public.clinic_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'pending_approval', 'active', 'expired', 'suspended')),
  trial_ends_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by uuid,
  payment_provider text,
  payment_id text,
  plan_name text DEFAULT 'basic',
  amount numeric DEFAULT 0,
  billing_cycle text DEFAULT 'monthly',
  next_billing_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;

-- Super admin table (platform owners like you)
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()
  )
$$;

-- Function to get clinic subscription status
CREATE OR REPLACE FUNCTION public.get_clinic_subscription_status(p_clinic_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.status = 'trial' AND s.trial_ends_at > now() THEN 'trial'
    WHEN s.status = 'trial' AND s.trial_ends_at <= now() THEN 'trial_expired'
    WHEN s.status = 'active' THEN 'active'
    WHEN s.status = 'suspended' THEN 'suspended'
    WHEN s.status = 'pending_approval' THEN 'pending_approval'
    ELSE 'expired'
  END
  FROM public.clinic_subscriptions s
  WHERE s.clinic_id = p_clinic_id
$$;

-- RLS for clinic_subscriptions
CREATE POLICY "Clinic owner can view own subscription"
ON public.clinic_subscriptions FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id() OR is_super_admin());

CREATE POLICY "Super admin can manage all subscriptions"
ON public.clinic_subscriptions FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- RLS for super_admins (only super admins can see the table)
CREATE POLICY "Super admins can view"
ON public.super_admins FOR SELECT TO authenticated
USING (is_super_admin() OR user_id = auth.uid());

-- Trigger: auto-create subscription when clinic is created
CREATE OR REPLACE FUNCTION public.auto_create_clinic_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_subscriptions (clinic_id, status, trial_ends_at)
  VALUES (NEW.id, 'trial', now() + interval '30 days');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_clinic_created_subscription
AFTER INSERT ON public.clinics
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_clinic_subscription();

-- Updated_at trigger
CREATE TRIGGER update_clinic_subscriptions_updated_at
BEFORE UPDATE ON public.clinic_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();