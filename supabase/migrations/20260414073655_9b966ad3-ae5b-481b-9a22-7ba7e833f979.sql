
-- Consultation logs for doctor performance tracking
CREATE TABLE public.consultation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.profiles(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  checkin_at TIMESTAMP WITH TIME ZONE,
  consultation_start TIMESTAMP WITH TIME ZONE,
  consultation_end TIMESTAMP WITH TIME ZONE,
  procedure_start TIMESTAMP WITH TIME ZONE,
  procedure_end TIMESTAMP WITH TIME ZONE,
  billing_at TIMESTAMP WITH TIME ZONE,
  payment_at TIMESTAMP WITH TIME ZONE,
  procedure_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consultation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view consultation logs"
ON public.consultation_logs FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert consultation logs"
ON public.consultation_logs FOR INSERT TO authenticated
WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update consultation logs"
ON public.consultation_logs FOR UPDATE TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete consultation logs"
ON public.consultation_logs FOR DELETE TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE TRIGGER update_consultation_logs_updated_at
BEFORE UPDATE ON public.consultation_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_consultation_logs_clinic ON public.consultation_logs(clinic_id);
CREATE INDEX idx_consultation_logs_doctor ON public.consultation_logs(doctor_id);
CREATE INDEX idx_consultation_logs_date ON public.consultation_logs(created_at);
