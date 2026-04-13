
-- Create lab_directory table
CREATE TABLE public.lab_directory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lab_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  whatsapp TEXT,
  speciality TEXT,
  default_tat_days INTEGER DEFAULT 7,
  default_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view labs" ON public.lab_directory FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert labs" ON public.lab_directory FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update labs" ON public.lab_directory FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete labs" ON public.lab_directory FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

CREATE INDEX idx_lab_directory_clinic ON public.lab_directory (clinic_id);

-- Add new columns to lab_orders
ALTER TABLE public.lab_orders 
  ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'Crown',
  ADD COLUMN IF NOT EXISTS shade TEXT,
  ADD COLUMN IF NOT EXISTS lab_directory_id UUID REFERENCES public.lab_directory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Update default status to 'draft'
ALTER TABLE public.lab_orders ALTER COLUMN status SET DEFAULT 'draft';
