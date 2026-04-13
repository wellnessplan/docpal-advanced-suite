
-- Create daily_todos table
CREATE TABLE public.daily_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  reference_id UUID,
  reference_table TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_todos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clinic staff can view todos"
  ON public.daily_todos FOR SELECT
  TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert todos"
  ON public.daily_todos FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update todos"
  ON public.daily_todos FOR UPDATE
  TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete todos"
  ON public.daily_todos FOR DELETE
  TO authenticated
  USING (clinic_id = get_user_clinic_id());

-- Index for fast daily queries
CREATE INDEX idx_daily_todos_clinic_date ON public.daily_todos (clinic_id, created_at, status);
CREATE INDEX idx_daily_todos_type ON public.daily_todos (task_type);

-- Enable pg_cron and pg_net for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
