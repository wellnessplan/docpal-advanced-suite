DROP POLICY IF EXISTS "Anyone can view registration settings" ON public.clinic_registration_settings;
CREATE POLICY "Clinic staff can view registration settings"
  ON public.clinic_registration_settings
  FOR SELECT TO authenticated
  USING (clinic_id = public.get_user_clinic_id());