
DROP POLICY IF EXISTS "Clinic staff insert own emails" ON public.outgoing_emails;
CREATE POLICY "Clinic staff insert own clinic emails"
  ON public.outgoing_emails FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id IS NOT NULL AND clinic_id = public.get_user_clinic_id());

DROP POLICY IF EXISTS "Service role manages all emails" ON public.outgoing_emails;
CREATE POLICY "Service role manages all emails"
  ON public.outgoing_emails FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
