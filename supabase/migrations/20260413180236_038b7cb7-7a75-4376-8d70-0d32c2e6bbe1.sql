
-- WhatsApp message templates (configurable per clinic)
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'reminder',
  message_body TEXT NOT NULL,
  timing_offset_hours INTEGER NOT NULL DEFAULT 24,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, template_name)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert templates" ON public.whatsapp_templates FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update templates" ON public.whatsapp_templates FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete templates" ON public.whatsapp_templates FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WhatsApp message log
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  phone TEXT,
  message_body TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view logs" ON public.whatsapp_logs FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert logs" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());

-- Service role needs to insert logs from edge function
CREATE POLICY "Service role can insert logs" ON public.whatsapp_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can select for automation" ON public.whatsapp_logs FOR SELECT TO service_role USING (true);

-- Service role policies for templates (edge function reads)
CREATE POLICY "Service role can read templates" ON public.whatsapp_templates FOR SELECT TO service_role USING (true);
