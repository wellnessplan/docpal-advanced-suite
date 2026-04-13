
-- Treatment Plans
CREATE TABLE public.treatment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  plan_name text NOT NULL DEFAULT 'Treatment Plan',
  status text NOT NULL DEFAULT 'draft',
  total_estimated_cost numeric DEFAULT 0,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view treatment plans" ON public.treatment_plans FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert treatment plans" ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update treatment plans" ON public.treatment_plans FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete treatment plans" ON public.treatment_plans FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Treatment Plan Items
CREATE TABLE public.treatment_plan_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  tooth_number integer,
  procedure_name text NOT NULL,
  estimated_cost numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view plan items" ON public.treatment_plan_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM treatment_plans WHERE treatment_plans.id = treatment_plan_items.treatment_plan_id AND treatment_plans.clinic_id = get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert plan items" ON public.treatment_plan_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM treatment_plans WHERE treatment_plans.id = treatment_plan_items.treatment_plan_id AND treatment_plans.clinic_id = get_user_clinic_id()));
CREATE POLICY "Clinic staff can update plan items" ON public.treatment_plan_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM treatment_plans WHERE treatment_plans.id = treatment_plan_items.treatment_plan_id AND treatment_plans.clinic_id = get_user_clinic_id()));
CREATE POLICY "Clinic staff can delete plan items" ON public.treatment_plan_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM treatment_plans WHERE treatment_plans.id = treatment_plan_items.treatment_plan_id AND treatment_plans.clinic_id = get_user_clinic_id()));

-- Payments (EMI / partial payment tracker)
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  invoice_id uuid REFERENCES public.invoices(id),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  payment_date date DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view payments" ON public.payments FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update payments" ON public.payments FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Insurance Claims
CREATE TABLE public.insurance_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  invoice_id uuid REFERENCES public.invoices(id),
  claim_number text,
  insurer_name text NOT NULL,
  policy_number text,
  pre_auth_status text DEFAULT 'pending',
  pre_auth_amount numeric DEFAULT 0,
  claim_amount numeric DEFAULT 0,
  approved_amount numeric DEFAULT 0,
  settlement_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  settled_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view claims" ON public.insurance_claims FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert claims" ON public.insurance_claims FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update claims" ON public.insurance_claims FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Leads
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  full_name text NOT NULL,
  phone text,
  email text,
  source text DEFAULT 'walk-in',
  interested_in text,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES public.profiles(id),
  notes text,
  converted_patient_id uuid REFERENCES public.patients(id),
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view leads" ON public.leads FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update leads" ON public.leads FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete leads" ON public.leads FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Reviews
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid REFERENCES public.patients(id),
  rating integer NOT NULL DEFAULT 5,
  feedback text,
  google_review_sent boolean DEFAULT false,
  google_review_completed boolean DEFAULT false,
  response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view reviews" ON public.reviews FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update reviews" ON public.reviews FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Referrals
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  referring_patient_id uuid REFERENCES public.patients(id),
  referred_name text NOT NULL,
  referred_phone text,
  converted_patient_id uuid REFERENCES public.patients(id),
  reward_type text DEFAULT 'discount',
  reward_amount numeric DEFAULT 0,
  reward_status text DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view referrals" ON public.referrals FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update referrals" ON public.referrals FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Memberships
CREATE TABLE public.memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  plan_name text NOT NULL DEFAULT 'Basic',
  plan_type text DEFAULT 'individual',
  amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  benefits jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view memberships" ON public.memberships FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert memberships" ON public.memberships FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update memberships" ON public.memberships FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Staff Attendance
CREATE TABLE public.staff_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL DEFAULT 'present',
  leave_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view attendance" ON public.staff_attendance FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert attendance" ON public.staff_attendance FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update attendance" ON public.staff_attendance FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Audit Log
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());

-- Triggers for updated_at
CREATE TRIGGER update_treatment_plans_updated_at BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insurance_claims_updated_at BEFORE UPDATE ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
