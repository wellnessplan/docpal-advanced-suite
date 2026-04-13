
-- ===================== ADD MISSING COLUMNS =====================

-- Patients: add op_number and date_of_birth
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS op_number TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Auto-generate op_number
CREATE OR REPLACE FUNCTION public.generate_op_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.op_number IS NULL THEN
    NEW.op_number := 'OP-' || LPAD(nextval('op_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS op_number_seq START WITH 1;
CREATE TRIGGER set_op_number BEFORE INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION public.generate_op_number();

-- Appointments: add scheduled_at, duration_minutes, provider_id
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Invoices: add missing columns
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Invoice Items: add total default
ALTER TABLE public.invoice_items ALTER COLUMN total SET DEFAULT 0;

-- Queue Tokens: add provider_id, priority, counter_number, notes
ALTER TABLE public.queue_tokens ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.queue_tokens ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.queue_tokens ADD COLUMN IF NOT EXISTS counter_number TEXT;
ALTER TABLE public.queue_tokens ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ortho Cases: add missing fields
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS orthodontist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS malocclusion_class TEXT;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS skeletal_pattern TEXT;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS case_start_date DATE;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS estimated_duration_months INTEGER;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS total_estimated_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS pre_treatment_checklist JSONB DEFAULT '{}';
ALTER TABLE public.ortho_cases ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ortho Visits: add missing fields
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS visit_number INTEGER;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS visit_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS wire_upper TEXT;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS wire_lower TEXT;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS bracket_arch TEXT;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS bracket_slot TEXT;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS bracket_prescription TEXT;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS auxiliaries_used TEXT[];
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS elastic_instructions_given BOOLEAN DEFAULT false;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS next_appointment_interval_weeks INTEGER;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS clinical_photos_taken BOOLEAN DEFAULT false;
ALTER TABLE public.ortho_visits ADD COLUMN IF NOT EXISTS progress_notes TEXT;

-- Treatment Material Mappings: add clinic_id, treatment_name, quantity_needed
ALTER TABLE public.treatment_material_mappings ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.treatment_material_mappings ADD COLUMN IF NOT EXISTS treatment_name TEXT;
ALTER TABLE public.treatment_material_mappings ADD COLUMN IF NOT EXISTS quantity_needed NUMERIC(10,2) DEFAULT 1;

-- Treatment Pricing: add base_price as alias
ALTER TABLE public.treatment_pricing ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2);

-- ===================== NEW TABLES =====================

-- Prescription Items
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT,
  tooth_number INTEGER,
  condition TEXT,
  treatment TEXT,
  treatment_status TEXT DEFAULT 'planned',
  cost NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage prescription items" ON public.prescription_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Aligner Cases
CREATE TABLE IF NOT EXISTS public.ortho_aligner_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  aligner_brand TEXT,
  total_upper_aligners INTEGER DEFAULT 0,
  total_lower_aligners INTEGER DEFAULT 0,
  current_upper_aligner INTEGER DEFAULT 1,
  current_lower_aligner INTEGER DEFAULT 1,
  change_interval_days INTEGER DEFAULT 14,
  compliance_hours_per_day NUMERIC(4,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_aligner_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage aligner cases" ON public.ortho_aligner_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Aligner Refinements
CREATE TABLE IF NOT EXISTS public.ortho_aligner_refinements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aligner_case_id UUID REFERENCES public.ortho_aligner_cases(id) ON DELETE CASCADE NOT NULL,
  refinement_number INTEGER DEFAULT 1,
  upper_aligners INTEGER DEFAULT 0,
  lower_aligners INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_aligner_refinements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage refinements" ON public.ortho_aligner_refinements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho IPR Log
CREATE TABLE IF NOT EXISTS public.ortho_ipr_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  tooth_number INTEGER NOT NULL,
  mm_removed NUMERIC(4,2) NOT NULL,
  visit_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_ipr_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage IPR" ON public.ortho_ipr_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Financial Milestones
CREATE TABLE IF NOT EXISTS public.ortho_financial_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  milestone_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_financial_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage milestones" ON public.ortho_financial_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Photo Records
CREATE TABLE IF NOT EXISTS public.ortho_photo_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  photo_type TEXT NOT NULL,
  photo_category TEXT DEFAULT 'intraoral',
  photo_url TEXT NOT NULL,
  visit_number INTEGER,
  consent_for_education BOOLEAN DEFAULT false,
  record_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_photo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage photos" ON public.ortho_photo_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Cephalometrics
CREATE TABLE IF NOT EXISTS public.ortho_cephalometrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  record_date DATE DEFAULT CURRENT_DATE,
  record_type TEXT DEFAULT 'pre_treatment',
  sna NUMERIC(5,1), snb NUMERIC(5,1), anb NUMERIC(5,1),
  wits_appraisal NUMERIC(5,1),
  u1_to_na_angle NUMERIC(5,1), u1_to_na_mm NUMERIC(5,1),
  l1_to_nb_angle NUMERIC(5,1), l1_to_nb_mm NUMERIC(5,1),
  fma NUMERIC(5,1), impa NUMERIC(5,1),
  overjet NUMERIC(5,1), overbite NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_cephalometrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage ceph" ON public.ortho_cephalometrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Consent Forms
CREATE TABLE IF NOT EXISTS public.ortho_consent_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  form_type TEXT NOT NULL,
  form_content TEXT,
  is_minor BOOLEAN DEFAULT false,
  guardian_name TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_consent_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage consent" ON public.ortho_consent_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Debond Records
CREATE TABLE IF NOT EXISTS public.ortho_debond_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  debond_date DATE NOT NULL,
  bracket_removal BOOLEAN DEFAULT false,
  band_removal BOOLEAN DEFAULT false,
  bonded_retainer_placed BOOLEAN DEFAULT false,
  impressions_taken BOOLEAN DEFAULT false,
  retainer_type TEXT,
  retainer_delivery_date DATE,
  retainer_instructions_given BOOLEAN DEFAULT false,
  retention_schedule JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_debond_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage debond" ON public.ortho_debond_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ortho Treatment Phases
CREATE TABLE IF NOT EXISTS public.ortho_treatment_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  phase_number INTEGER DEFAULT 1,
  phase_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  estimated_visits INTEGER,
  visit_interval_weeks INTEGER,
  estimated_cost NUMERIC(10,2) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_treatment_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage phases" ON public.ortho_treatment_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===================== HELPER FUNCTION =====================
CREATE OR REPLACE FUNCTION public.get_next_token_number(p_clinic_id UUID, p_date DATE)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(token_number), 0) + 1
  FROM public.queue_tokens
  WHERE clinic_id = p_clinic_id AND queue_date = p_date
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
