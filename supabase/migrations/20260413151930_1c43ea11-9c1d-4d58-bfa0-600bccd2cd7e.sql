
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view campaigns" ON public.campaigns FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  chart_type TEXT DEFAULT 'adult',
  chief_complaint TEXT,
  gum_condition TEXT DEFAULT 'normal',
  alignment_condition TEXT DEFAULT 'normal',
  diagnosis_notes TEXT,
  treatment_plan TEXT,
  medications JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update prescriptions" ON public.prescriptions FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete prescriptions" ON public.prescriptions FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update prescription_items to reference prescriptions table properly
ALTER TABLE public.prescription_items ALTER COLUMN prescription_id TYPE UUID USING prescription_id::UUID;
ALTER TABLE public.prescription_items ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;
