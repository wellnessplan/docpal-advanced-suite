
-- Utility: update_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===================== CLINICS =====================
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- ===================== PROFILES =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  full_name TEXT,
  role TEXT DEFAULT 'doctor',
  specialization TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================== PATIENTS =====================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone TEXT,
  email TEXT,
  blood_group TEXT,
  medical_history TEXT,
  allergies TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- ===================== APPOINTMENTS =====================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  type TEXT DEFAULT 'checkup',
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ===================== INVOICES =====================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  payment_method TEXT,
  notes TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ===================== INVOICE ITEMS =====================
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- ===================== EXPENSES =====================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  category TEXT,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ===================== QUEUE TOKENS =====================
CREATE TABLE public.queue_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  token_number INTEGER NOT NULL,
  status TEXT DEFAULT 'waiting',
  queue_date DATE DEFAULT CURRENT_DATE,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;

-- ===================== TOOTH RECORDS =====================
CREATE TABLE public.tooth_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  tooth_number INTEGER NOT NULL,
  status TEXT DEFAULT 'healthy',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, tooth_number)
);
ALTER TABLE public.tooth_records ENABLE ROW LEVEL SECURITY;

-- ===================== TOOTH CONDITIONS =====================
CREATE TABLE public.tooth_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooth_record_id UUID REFERENCES public.tooth_records(id) ON DELETE CASCADE NOT NULL,
  condition_name TEXT NOT NULL,
  severity TEXT DEFAULT 'mild',
  surface TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tooth_conditions ENABLE ROW LEVEL SECURITY;

-- ===================== TOOTH TREATMENTS =====================
CREATE TABLE public.tooth_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooth_record_id UUID REFERENCES public.tooth_records(id) ON DELETE CASCADE NOT NULL,
  treatment_name TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  cost NUMERIC(10,2),
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tooth_treatments ENABLE ROW LEVEL SECURITY;

-- ===================== INVENTORY ITEMS (before treatment_pricing references) =====================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC(10,2) DEFAULT 0,
  min_stock_level NUMERIC(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  unit_cost NUMERIC(10,2) DEFAULT 0,
  supplier TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- ===================== TREATMENT PRICING =====================
CREATE TABLE public.treatment_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  treatment_name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_pricing ENABLE ROW LEVEL SECURITY;

-- ===================== TREATMENT MATERIAL MAPPINGS =====================
CREATE TABLE public.treatment_material_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_pricing_id UUID REFERENCES public.treatment_pricing(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
  quantity_used NUMERIC(10,2) DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_material_mappings ENABLE ROW LEVEL SECURITY;

-- ===================== PATIENT DOCUMENTS =====================
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT DEFAULT 'general',
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- ===================== PATIENT COMMUNICATIONS =====================
CREATE TABLE public.patient_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound',
  subject TEXT,
  content TEXT,
  status TEXT DEFAULT 'sent',
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_communications ENABLE ROW LEVEL SECURITY;

-- ===================== ORTHO CASES =====================
CREATE TABLE public.ortho_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_type TEXT DEFAULT 'braces',
  diagnosis TEXT,
  treatment_plan TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  estimated_end_date DATE,
  actual_end_date DATE,
  total_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_cases ENABLE ROW LEVEL SECURITY;

-- ===================== ORTHO VISITS =====================
CREATE TABLE public.ortho_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.ortho_cases(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  notes TEXT,
  wire_change BOOLEAN DEFAULT false,
  bracket_issues TEXT,
  next_visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ortho_visits ENABLE ROW LEVEL SECURITY;

-- ===================== CLINIC SETTINGS =====================
CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, setting_key)
);
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- ===================== DEDUCT INVENTORY FUNCTION =====================
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_item_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory_items
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE id = p_item_id AND quantity >= p_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===================== HELPER FUNCTION =====================
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ===================== UPDATE TRIGGERS =====================
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tooth_records_updated_at BEFORE UPDATE ON public.tooth_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tooth_treatments_updated_at BEFORE UPDATE ON public.tooth_treatments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_treatment_pricing_updated_at BEFORE UPDATE ON public.treatment_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ortho_cases_updated_at BEFORE UPDATE ON public.ortho_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clinic_settings_updated_at BEFORE UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== RLS POLICIES =====================

-- CLINICS
CREATE POLICY "Users can view own clinic" ON public.clinics FOR SELECT TO authenticated USING (id = public.get_user_clinic_id());
CREATE POLICY "Users can update own clinic" ON public.clinics FOR UPDATE TO authenticated USING (id = public.get_user_clinic_id());
CREATE POLICY "Authenticated users can create clinics" ON public.clinics FOR INSERT TO authenticated WITH CHECK (true);

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view clinic profiles" ON public.profiles FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- PATIENTS
CREATE POLICY "Clinic staff can view patients" ON public.patients FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update patients" ON public.patients FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete patients" ON public.patients FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- APPOINTMENTS
CREATE POLICY "Clinic staff can view appointments" ON public.appointments FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- INVOICES
CREATE POLICY "Clinic staff can view invoices" ON public.invoices FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- INVOICE ITEMS
CREATE POLICY "Clinic staff can view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.clinic_id = public.get_user_clinic_id()));

-- EXPENSES
CREATE POLICY "Clinic staff can view expenses" ON public.expenses FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- QUEUE TOKENS
CREATE POLICY "Clinic staff can view queue" ON public.queue_tokens FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert queue" ON public.queue_tokens FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update queue" ON public.queue_tokens FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete queue" ON public.queue_tokens FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- TOOTH RECORDS
CREATE POLICY "Clinic staff can view tooth records" ON public.tooth_records FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert tooth records" ON public.tooth_records FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update tooth records" ON public.tooth_records FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- TOOTH CONDITIONS
CREATE POLICY "Clinic staff can view tooth conditions" ON public.tooth_conditions FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.tooth_records WHERE tooth_records.id = tooth_conditions.tooth_record_id AND tooth_records.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert tooth conditions" ON public.tooth_conditions FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.tooth_records WHERE tooth_records.id = tooth_conditions.tooth_record_id AND tooth_records.clinic_id = public.get_user_clinic_id()));

-- TOOTH TREATMENTS
CREATE POLICY "Clinic staff can view tooth treatments" ON public.tooth_treatments FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.tooth_records WHERE tooth_records.id = tooth_treatments.tooth_record_id AND tooth_records.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert tooth treatments" ON public.tooth_treatments FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.tooth_records WHERE tooth_records.id = tooth_treatments.tooth_record_id AND tooth_records.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can update tooth treatments" ON public.tooth_treatments FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.tooth_records WHERE tooth_records.id = tooth_treatments.tooth_record_id AND tooth_records.clinic_id = public.get_user_clinic_id()));

-- TREATMENT PRICING
CREATE POLICY "Clinic staff can view pricing" ON public.treatment_pricing FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert pricing" ON public.treatment_pricing FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update pricing" ON public.treatment_pricing FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete pricing" ON public.treatment_pricing FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- TREATMENT MATERIAL MAPPINGS
CREATE POLICY "Clinic staff can view mappings" ON public.treatment_material_mappings FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.treatment_pricing WHERE treatment_pricing.id = treatment_material_mappings.treatment_pricing_id AND treatment_pricing.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert mappings" ON public.treatment_material_mappings FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.treatment_pricing WHERE treatment_pricing.id = treatment_material_mappings.treatment_pricing_id AND treatment_pricing.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can delete mappings" ON public.treatment_material_mappings FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.treatment_pricing WHERE treatment_pricing.id = treatment_material_mappings.treatment_pricing_id AND treatment_pricing.clinic_id = public.get_user_clinic_id()));

-- INVENTORY ITEMS
CREATE POLICY "Clinic staff can view inventory" ON public.inventory_items FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- PATIENT DOCUMENTS
CREATE POLICY "Clinic staff can view documents" ON public.patient_documents FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert documents" ON public.patient_documents FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can delete documents" ON public.patient_documents FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- PATIENT COMMUNICATIONS
CREATE POLICY "Clinic staff can view communications" ON public.patient_communications FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert communications" ON public.patient_communications FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());

-- ORTHO CASES
CREATE POLICY "Clinic staff can view ortho cases" ON public.ortho_cases FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert ortho cases" ON public.ortho_cases FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update ortho cases" ON public.ortho_cases FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- ORTHO VISITS
CREATE POLICY "Clinic staff can view ortho visits" ON public.ortho_visits FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_visits.case_id AND ortho_cases.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert ortho visits" ON public.ortho_visits FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_visits.case_id AND ortho_cases.clinic_id = public.get_user_clinic_id()));

-- CLINIC SETTINGS
CREATE POLICY "Clinic staff can view settings" ON public.clinic_settings FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can insert settings" ON public.clinic_settings FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff can update settings" ON public.clinic_settings FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- ===================== STORAGE =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-files', 'patient-files', false);
CREATE POLICY "Auth users can upload patient files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-files');
CREATE POLICY "Auth users can view patient files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'patient-files');
CREATE POLICY "Auth users can delete patient files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'patient-files');
