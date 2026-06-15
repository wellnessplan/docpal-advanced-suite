
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS usage_counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dunning_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dunning_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_benefits_card_at timestamptz;

CREATE OR REPLACE FUNCTION public.membership_revenue_metrics(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mrr numeric := 0;
  v_arr numeric := 0;
  v_active int := 0;
  v_churned_30d int := 0;
  v_churn_pct numeric := 0;
  v_total_ever int := 0;
  v_lifetime_revenue numeric := 0;
  v_avg_lifetime_months numeric := 0;
  v_ltv numeric := 0;
BEGIN
  IF p_clinic_id IS DISTINCT FROM public.get_user_clinic_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- MRR: each active membership contributes amount / duration_months (fallback 12)
  SELECT
    COALESCE(SUM(
      CASE WHEN COALESCE(mp.duration_months, 12) > 0
           THEN m.amount / COALESCE(mp.duration_months, 12)::numeric
           ELSE 0 END
    ), 0),
    COUNT(*) FILTER (WHERE m.status = 'active')
  INTO v_mrr, v_active
  FROM public.memberships m
  LEFT JOIN public.membership_plans mp ON mp.id::text = m.plan_type
  WHERE m.clinic_id = p_clinic_id AND m.status = 'active';

  v_arr := v_mrr * 12;

  -- Churn in last 30 days: cancelled or suspended in last 30 days
  SELECT COUNT(*) INTO v_churned_30d
  FROM public.memberships
  WHERE clinic_id = p_clinic_id
    AND status IN ('cancelled', 'suspended', 'expired')
    AND updated_at >= now() - interval '30 days';

  v_churn_pct := CASE WHEN (v_active + v_churned_30d) > 0
                      THEN (v_churned_30d::numeric / (v_active + v_churned_30d)) * 100
                      ELSE 0 END;

  -- LTV approximation: avg lifetime revenue per member over all-time membership lifespan
  SELECT
    COUNT(*),
    COALESCE(SUM(amount), 0),
    COALESCE(AVG(EXTRACT(epoch FROM (COALESCE(end_date, CURRENT_DATE) - start_date)) / (86400 * 30)), 0)
  INTO v_total_ever, v_lifetime_revenue, v_avg_lifetime_months
  FROM public.memberships
  WHERE clinic_id = p_clinic_id;

  -- LTV = average revenue per member (simple)
  v_ltv := CASE WHEN v_total_ever > 0 THEN v_lifetime_revenue / v_total_ever ELSE 0 END;

  RETURN jsonb_build_object(
    'mrr', round(v_mrr, 2),
    'arr', round(v_arr, 2),
    'active', v_active,
    'churned_30d', v_churned_30d,
    'churn_pct', round(v_churn_pct, 1),
    'total_members_ever', v_total_ever,
    'lifetime_revenue', round(v_lifetime_revenue, 2),
    'avg_lifetime_months', round(v_avg_lifetime_months, 1),
    'ltv', round(v_ltv, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.membership_revenue_metrics(uuid) TO authenticated;
