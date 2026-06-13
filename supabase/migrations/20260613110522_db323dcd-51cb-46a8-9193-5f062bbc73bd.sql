
-- ============ 1. clinics: remove anon broad SELECT ============
DROP POLICY IF EXISTS "Anon can verify clinic exists" ON public.clinics;

-- ============ 2. display_screens: restrict anon UPDATE to heartbeat columns only ============
DROP POLICY IF EXISTS "Public heartbeat update" ON public.display_screens;
CREATE POLICY "Public heartbeat update"
  ON public.display_screens FOR UPDATE
  TO anon
  USING (true) WITH CHECK (true);
REVOKE UPDATE ON public.display_screens FROM anon;
GRANT UPDATE (last_seen_at, is_paired, app_version, last_error, last_error_at)
  ON public.display_screens TO anon;

-- ============ 3. payments: drop Dev bypass policies ============
DROP POLICY IF EXISTS "Dev bypass insert payments" ON public.payments;
DROP POLICY IF EXISTS "Dev bypass select payments" ON public.payments;
DROP POLICY IF EXISTS "Dev bypass update payments" ON public.payments;

-- ============ 4. prescription_items: drop unrestricted auth-all policy ============
DROP POLICY IF EXISTS "Auth users can manage prescription items" ON public.prescription_items;

-- ============ 5. referrals: drop unrestricted policies, scope to clinic staff ============
DROP POLICY IF EXISTS "Allow anon insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow anon select referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow anon update referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow select referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow update referrals" ON public.referrals;
CREATE POLICY "Clinic staff select referrals" ON public.referrals
  FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff insert referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff update referrals" ON public.referrals
  FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff delete referrals" ON public.referrals
  FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- ============ 6. reviews: drop unrestricted policies, scope to clinic staff ============
DROP POLICY IF EXISTS "Allow anon insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow anon select reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow anon update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow select reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow update reviews" ON public.reviews;
CREATE POLICY "Clinic staff select reviews" ON public.reviews
  FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff insert reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff update reviews" ON public.reviews
  FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Clinic staff delete reviews" ON public.reviews
  FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- ============ 7. staff_invitations: remove broad anon read; provide token-scoped RPC ============
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.staff_invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  clinic_id uuid,
  email text,
  full_name text,
  role text,
  status text,
  expires_at timestamptz,
  clinic_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.clinic_id, i.email, i.full_name, i.role::text, i.status, i.expires_at, c.name
  FROM public.staff_invitations i
  LEFT JOIN public.clinics c ON c.id = i.clinic_id
  WHERE i.invite_token = p_token
    AND i.status = 'pending'
    AND (i.expires_at IS NULL OR i.expires_at > now())
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- ============ 8. Drop "Dev public access" policies on dental tables ============
DROP POLICY IF EXISTS "Dev public access tooth_conditions" ON public.tooth_conditions;
DROP POLICY IF EXISTS "Dev public access tooth_records" ON public.tooth_records;
DROP POLICY IF EXISTS "Dev public access tooth_treatments" ON public.tooth_treatments;
DROP POLICY IF EXISTS "Dev public access treatment_plans" ON public.treatment_plans;
DROP POLICY IF EXISTS "Dev public access treatment_plan_items" ON public.treatment_plan_items;

-- Add UPDATE/DELETE policies for tooth_conditions and tooth_treatments where missing
CREATE POLICY "Clinic staff update tooth conditions" ON public.tooth_conditions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tooth_records r WHERE r.id = tooth_conditions.tooth_record_id AND r.clinic_id = public.get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tooth_records r WHERE r.id = tooth_conditions.tooth_record_id AND r.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff delete tooth conditions" ON public.tooth_conditions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tooth_records r WHERE r.id = tooth_conditions.tooth_record_id AND r.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff delete tooth treatments" ON public.tooth_treatments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tooth_records r WHERE r.id = tooth_treatments.tooth_record_id AND r.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Clinic staff delete tooth records" ON public.tooth_records
  FOR DELETE TO authenticated USING (clinic_id = public.get_user_clinic_id());

-- ============ 9. whatsapp_delivery_status: restrict to service_role only ============
DROP POLICY IF EXISTS "service all wds" ON public.whatsapp_delivery_status;
CREATE POLICY "service role manages wds" ON public.whatsapp_delivery_status
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ 10. Storage: patient-files clinic-scoped ownership ============
DROP POLICY IF EXISTS "Auth users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view patient files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view patient files" ON storage.objects;

CREATE POLICY "Clinic staff view patient files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-files' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);
CREATE POLICY "Clinic staff upload patient files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-files' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);
CREATE POLICY "Clinic staff update patient files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-files' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);
CREATE POLICY "Clinic staff delete patient files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-files' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);

-- ============ 11. Storage: social-media DELETE/UPDATE clinic-scoped ============
DROP POLICY IF EXISTS "Auth delete social-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth update social-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload social-media" ON storage.objects;

CREATE POLICY "Clinic staff upload social-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);
CREATE POLICY "Clinic staff update social-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'social-media' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);
CREATE POLICY "Clinic staff delete social-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'social-media' AND (storage.foldername(name))[1] = (public.get_user_clinic_id())::text);

-- ============ 12. tenant_health view: enforce caller's permissions ============
ALTER VIEW public.tenant_health SET (security_invoker = on);
