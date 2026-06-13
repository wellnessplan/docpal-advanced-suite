
-- =====================================================================
-- platform_invoices
-- =====================================================================
CREATE TABLE public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.clinic_subscriptions(id) ON DELETE SET NULL,
  plan_code text,
  amount_inr numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  provider text,                          -- razorpay | stripe | manual
  provider_payment_id text,
  provider_order_id text,
  receipt_url text,
  billing_cycle text,                     -- monthly | yearly
  period_start date,
  period_end date,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_invoices_clinic ON public.platform_invoices(clinic_id);
CREATE INDEX idx_platform_invoices_status ON public.platform_invoices(status);
CREATE INDEX idx_platform_invoices_paid_at ON public.platform_invoices(paid_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_invoices TO authenticated;
GRANT ALL ON public.platform_invoices TO service_role;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage invoices" ON public.platform_invoices
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Clinic sees own invoices" ON public.platform_invoices
  FOR SELECT TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER trg_platform_invoices_updated
  BEFORE UPDATE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- platform_settings (singleton-ish key/value)
-- =====================================================================
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins write settings" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins update settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins delete settings" ON public.platform_settings
  FOR DELETE TO authenticated USING (public.is_super_admin());

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('default_trial_days', '30'::jsonb, 'Default trial length for new clinics (days)'),
  ('default_ai_cap_inr', '500'::jsonb, 'Default monthly AI spend cap per clinic (INR)'),
  ('feature_flags', '{"focus_mode": true, "ortho_module": true, "social_calendar": true, "patient_education": true}'::jsonb, 'Global feature toggles'),
  ('support_email', '"support@doctorsbuddy.in"'::jsonb, 'Support contact email shown to clinics'),
  ('support_whatsapp', '"+919999999999"'::jsonb, 'Support WhatsApp number')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- platform_announcements
-- =====================================================================
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  variant text NOT NULL DEFAULT 'info', -- info | success | warning | critical
  cta_label text,
  cta_url text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_active ON public.platform_announcements(active, starts_at DESC);

GRANT SELECT ON public.platform_announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_announcements TO authenticated;
GRANT ALL ON public.platform_announcements TO service_role;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active announcements" ON public.platform_announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins insert announcements" ON public.platform_announcements
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins update announcements" ON public.platform_announcements
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins delete announcements" ON public.platform_announcements
  FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.platform_announcement_dismissals (
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.platform_announcement_dismissals TO authenticated;
GRANT ALL ON public.platform_announcement_dismissals TO service_role;
ALTER TABLE public.platform_announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own dismissals" ON public.platform_announcement_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User inserts own dismissal" ON public.platform_announcement_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "User deletes own dismissal" ON public.platform_announcement_dismissals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =====================================================================
-- platform_revenue_metrics() — Pure SQL JSON for Revenue tab
-- =====================================================================
CREATE OR REPLACE FUNCTION public.platform_revenue_metrics(
  p_from date DEFAULT (now() - interval '30 days')::date,
  p_to   date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mrr numeric := 0;
  v_arr numeric := 0;
  v_churn numeric := 0;
  v_conversion numeric := 0;
  v_plan_mix jsonb;
  v_active_count int;
  v_churn_count int;
  v_trials_started int;
  v_trials_converted int;
  v_paid_in_period numeric;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- MRR: sum monthly-equivalent of all active subscriptions using plan price
  SELECT COALESCE(SUM(
    CASE
      WHEN p.billing_cycle = 'yearly' THEN p.price_inr / 12.0
      WHEN p.billing_cycle = 'monthly' THEN p.price_inr
      ELSE COALESCE(p.price_inr, 0)
    END
  ), 0)
  INTO v_mrr
  FROM public.clinic_subscriptions s
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.status = 'active';

  v_arr := v_mrr * 12;

  -- Active subs count and churned-in-period count
  SELECT count(*) INTO v_active_count
  FROM public.clinic_subscriptions WHERE status = 'active';

  SELECT count(*) INTO v_churn_count
  FROM public.clinic_subscriptions
  WHERE status IN ('suspended', 'expired')
    AND updated_at::date BETWEEN p_from AND p_to;

  v_churn := CASE WHEN (v_active_count + v_churn_count) > 0
                  THEN (v_churn_count::numeric / (v_active_count + v_churn_count)) * 100
                  ELSE 0 END;

  -- Trial→paid conversion: trials that began before p_to and are now active
  SELECT count(*) INTO v_trials_started
  FROM public.clinic_subscriptions
  WHERE created_at::date <= p_to;

  SELECT count(*) INTO v_trials_converted
  FROM public.clinic_subscriptions
  WHERE created_at::date <= p_to AND status = 'active' AND approved_at IS NOT NULL;

  v_conversion := CASE WHEN v_trials_started > 0
                       THEN (v_trials_converted::numeric / v_trials_started) * 100
                       ELSE 0 END;

  -- Plan mix
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'plan', COALESCE(p.name, s.plan_name, 'Unassigned'),
    'count', cnt
  ) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_plan_mix
  FROM (
    SELECT plan_id, plan_name, count(*) AS cnt
    FROM public.clinic_subscriptions
    WHERE status = 'active'
    GROUP BY plan_id, plan_name
  ) s
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id;

  -- Revenue actually collected in period
  SELECT COALESCE(SUM(amount_inr), 0) INTO v_paid_in_period
  FROM public.platform_invoices
  WHERE status = 'paid' AND paid_at::date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'mrr', round(v_mrr, 2),
    'arr', round(v_arr, 2),
    'churn_pct', round(v_churn, 2),
    'conversion_pct', round(v_conversion, 2),
    'active_subs', v_active_count,
    'churned_in_period', v_churn_count,
    'paid_in_period', round(v_paid_in_period, 2),
    'plan_mix', v_plan_mix
  );
END;
$$;

-- =====================================================================
-- mark_platform_invoice_paid() — webhook + manual entry point
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mark_platform_invoice_paid(
  p_invoice_id uuid,
  p_provider text DEFAULT 'manual',
  p_provider_payment_id text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.platform_invoices%ROWTYPE;
  v_next date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.platform_invoices
  SET status = 'paid',
      paid_at = now(),
      provider = COALESCE(p_provider, provider),
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
      receipt_url = COALESCE(p_receipt_url, receipt_url),
      updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Extend subscription
  v_next := COALESCE(v_inv.period_end, CURRENT_DATE)
            + CASE WHEN v_inv.billing_cycle = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;

  UPDATE public.clinic_subscriptions
  SET status = 'active',
      approved_at = COALESCE(approved_at, now()),
      next_billing_date = v_next,
      updated_at = now()
  WHERE clinic_id = v_inv.clinic_id;

  INSERT INTO public.platform_audit_log (actor_user_id, actor_name, action, target_type, target_id, target_label, details)
  VALUES (auth.uid(),
          COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'super_admin'),
          'invoice_paid', 'invoice', v_inv.id,
          (SELECT name FROM public.clinics WHERE id = v_inv.clinic_id),
          jsonb_build_object('amount', v_inv.amount_inr, 'provider', p_provider));

  RETURN jsonb_build_object('success', true, 'next_billing_date', v_next);
END;
$$;

-- =====================================================================
-- tenant_health view
-- =====================================================================
CREATE OR REPLACE VIEW public.tenant_health AS
SELECT
  c.id AS clinic_id,
  c.name,
  c.created_at AS joined_at,
  s.status AS subscription_status,
  s.trial_ends_at,
  (SELECT max(created_at) FROM public.appointments WHERE clinic_id = c.id) AS last_appointment_at,
  (SELECT count(*) FROM public.appointments WHERE clinic_id = c.id AND created_at > now() - interval '7 days') AS appts_7d,
  (SELECT count(*) FROM public.appointments WHERE clinic_id = c.id AND created_at > now() - interval '30 days') AS appts_30d,
  (SELECT count(*) FROM public.profiles WHERE clinic_id = c.id) AS staff_count,
  (SELECT count(*) FROM public.patients WHERE clinic_id = c.id) AS patient_count,
  (SELECT count(*) FROM public.edge_function_failures f
   WHERE f.clinic_id = c.id AND f.created_at > now() - interval '7 days') AS failures_7d,
  (SELECT count(*) FROM public.error_logs e
   WHERE e.clinic_id = c.id AND e.created_at > now() - interval '7 days' AND NOT e.resolved) AS unresolved_errors_7d
FROM public.clinics c
LEFT JOIN public.clinic_subscriptions s ON s.clinic_id = c.id;

GRANT SELECT ON public.tenant_health TO authenticated;
GRANT ALL ON public.tenant_health TO service_role;
