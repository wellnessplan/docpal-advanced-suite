-- =========================================================
-- Clinic working hours (per day of week)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.clinic_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun .. 6=Sat
  is_closed boolean NOT NULL DEFAULT false,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  break_start time,
  break_end time,
  slot_duration_minutes integer NOT NULL DEFAULT 30 CHECK (slot_duration_minutes BETWEEN 5 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, day_of_week)
);

ALTER TABLE public.clinic_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view working hours"
  ON public.clinic_working_hours FOR SELECT
  USING (true);

CREATE POLICY "Clinic staff can insert working hours"
  ON public.clinic_working_hours FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic staff can update working hours"
  ON public.clinic_working_hours FOR UPDATE TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic staff can delete working hours"
  ON public.clinic_working_hours FOR DELETE TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER trg_working_hours_updated
  BEFORE UPDATE ON public.clinic_working_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Registration page customization
-- =========================================================
CREATE TABLE IF NOT EXISTS public.clinic_registration_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  welcome_heading text DEFAULT 'Patient Registration',
  welcome_subheading text DEFAULT 'Fill in your details to get a queue token',
  banner_image_url text,
  brand_color text DEFAULT '#2563eb',
  thank_you_heading text DEFAULT 'Registration Successful!',
  thank_you_message text DEFAULT 'Thank you for registering. Please wait for your token to be called.',
  show_logo boolean NOT NULL DEFAULT true,
  action_links jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, url, icon, color}]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_registration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view registration settings"
  ON public.clinic_registration_settings FOR SELECT
  USING (true);

CREATE POLICY "Clinic staff can insert registration settings"
  ON public.clinic_registration_settings FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic staff can update registration settings"
  ON public.clinic_registration_settings FOR UPDATE TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic staff can delete registration settings"
  ON public.clinic_registration_settings FOR DELETE TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER trg_reg_settings_updated
  BEFORE UPDATE ON public.clinic_registration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();