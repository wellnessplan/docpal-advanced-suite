CREATE TABLE public.membership_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  plan_name TEXT NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 12,
  discount_percent NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  benefits TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select membership_plans" ON public.membership_plans FOR SELECT USING (true);
CREATE POLICY "Allow insert membership_plans" ON public.membership_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update membership_plans" ON public.membership_plans FOR UPDATE USING (true);
CREATE POLICY "Allow delete membership_plans" ON public.membership_plans FOR DELETE USING (true);

CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();