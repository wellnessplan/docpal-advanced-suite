ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_billing_cycle_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_billing_cycle_check CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text, 'lifetime'::text]));

INSERT INTO public.subscription_plans (code, name, price_inr, billing_cycle, features, is_active, sort_order)
VALUES ('lifetime', 'Lifetime', 50000, 'lifetime',
  '["One-time payment, never pay again","Unlimited patients","Unlimited doctors","Multi-branch support","All Pro & Enterprise features","Priority support for life","Free future updates"]'::jsonb,
  true, 100)
ON CONFLICT (code) DO UPDATE SET price_inr = EXCLUDED.price_inr, features = EXCLUDED.features, billing_cycle = EXCLUDED.billing_cycle, is_active = true;