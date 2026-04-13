
-- Lab work tracking
CREATE TABLE public.lab_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  tooth_treatment_id uuid REFERENCES public.tooth_treatments(id),
  lab_name text,
  item_description text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_date date DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  fitted_date date,
  cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view lab orders" ON public.lab_orders FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert lab orders" ON public.lab_orders FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update lab orders" ON public.lab_orders FOR UPDATE USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete lab orders" ON public.lab_orders FOR DELETE USING (clinic_id = get_user_clinic_id());

-- Consent forms
CREATE TABLE public.consent_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  procedure_name text NOT NULL,
  consent_type text NOT NULL DEFAULT 'checkbox',
  form_content text,
  signature_data text,
  consented_at timestamptz,
  witnessed_by text,
  is_minor boolean DEFAULT false,
  guardian_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view consent forms" ON public.consent_forms FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert consent forms" ON public.consent_forms FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());

-- Recall reminders
CREATE TABLE public.recall_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  reminder_type text NOT NULL DEFAULT 'checkup',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  last_visit_date date,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recall_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view reminders" ON public.recall_reminders FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert reminders" ON public.recall_reminders FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update reminders" ON public.recall_reminders FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- Doctor chairs for multi-doctor scheduling
CREATE TABLE public.doctor_chairs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  doctor_id uuid NOT NULL REFERENCES public.profiles(id),
  chair_label text NOT NULL,
  available_days text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_chairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view chairs" ON public.doctor_chairs FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert chairs" ON public.doctor_chairs FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update chairs" ON public.doctor_chairs FOR UPDATE USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete chairs" ON public.doctor_chairs FOR DELETE USING (clinic_id = get_user_clinic_id());
