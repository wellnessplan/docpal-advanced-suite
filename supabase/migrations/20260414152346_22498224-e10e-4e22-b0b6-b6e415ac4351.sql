
-- 1. DROP dangerous public policies on patients
DROP POLICY IF EXISTS "Public can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Public can view patients" ON public.patients;
DROP POLICY IF EXISTS "Public can update patients" ON public.patients;
DROP POLICY IF EXISTS "Public can delete patients" ON public.patients;

-- Add narrow anon INSERT for self-registration (validates clinic exists)
CREATE POLICY "Anon self-register insert" ON public.patients
  FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id));

-- Add anon RPC access for queue token generation
CREATE POLICY "Anon can call get_next_token" ON public.queue_tokens
  FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics WHERE id = clinic_id));

-- 2. DROP dev bypass policies on invoices
DROP POLICY IF EXISTS "Dev bypass insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Dev bypass select invoices" ON public.invoices;
DROP POLICY IF EXISTS "Dev bypass update invoices" ON public.invoices;

-- Add proper clinic-scoped policies for invoices
CREATE POLICY "Clinic staff can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id());

-- 3. DROP dev bypass policies on invoice_items
DROP POLICY IF EXISTS "Dev bypass insert invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Dev bypass select invoice_items" ON public.invoice_items;

-- 4. DROP dev bypass and public policies on lab_orders
DROP POLICY IF EXISTS "Dev bypass insert lab_orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Dev bypass select lab_orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Dev bypass update lab_orders" ON public.lab_orders;

-- Fix lab_orders policies from public to authenticated
DROP POLICY IF EXISTS "Clinic staff can view lab orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Clinic staff can insert lab orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Clinic staff can update lab orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Clinic staff can delete lab orders" ON public.lab_orders;

CREATE POLICY "Clinic staff can view lab orders" ON public.lab_orders
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert lab orders" ON public.lab_orders
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update lab orders" ON public.lab_orders
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete lab orders" ON public.lab_orders
  FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id());

-- 5. Fix membership_plans from public to authenticated
DROP POLICY IF EXISTS "Allow delete membership_plans" ON public.membership_plans;
DROP POLICY IF EXISTS "Allow insert membership_plans" ON public.membership_plans;
DROP POLICY IF EXISTS "Allow select membership_plans" ON public.membership_plans;
DROP POLICY IF EXISTS "Allow update membership_plans" ON public.membership_plans;

CREATE POLICY "Clinic staff can view membership plans" ON public.membership_plans
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert membership plans" ON public.membership_plans
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update membership plans" ON public.membership_plans
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete membership plans" ON public.membership_plans
  FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id());

-- 6. Fix ortho tables: replace USING(true) with clinic-scoped via ortho_cases join

-- ortho_aligner_cases
DROP POLICY IF EXISTS "Auth users manage aligner cases" ON public.ortho_aligner_cases;
CREATE POLICY "Clinic staff manage aligner cases" ON public.ortho_aligner_cases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_aligner_cases.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_aligner_cases.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_aligner_refinements
DROP POLICY IF EXISTS "Auth users manage refinements" ON public.ortho_aligner_refinements;
CREATE POLICY "Clinic staff manage refinements" ON public.ortho_aligner_refinements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_aligner_cases ac JOIN public.ortho_cases oc ON oc.id = ac.ortho_case_id WHERE ac.id = ortho_aligner_refinements.aligner_case_id AND oc.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_aligner_cases ac JOIN public.ortho_cases oc ON oc.id = ac.ortho_case_id WHERE ac.id = ortho_aligner_refinements.aligner_case_id AND oc.clinic_id = get_user_clinic_id()));

-- ortho_treatment_phases
DROP POLICY IF EXISTS "Auth users manage phases" ON public.ortho_treatment_phases;
CREATE POLICY "Clinic staff manage phases" ON public.ortho_treatment_phases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_treatment_phases.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_treatment_phases.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_photo_records
DROP POLICY IF EXISTS "Auth users manage photos" ON public.ortho_photo_records;
CREATE POLICY "Clinic staff manage photos" ON public.ortho_photo_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_photo_records.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_photo_records.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_cephalometrics
DROP POLICY IF EXISTS "Auth users manage ceph" ON public.ortho_cephalometrics;
CREATE POLICY "Clinic staff manage ceph" ON public.ortho_cephalometrics
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_cephalometrics.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_cephalometrics.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_financial_milestones
DROP POLICY IF EXISTS "Auth users manage milestones" ON public.ortho_financial_milestones;
CREATE POLICY "Clinic staff manage milestones" ON public.ortho_financial_milestones
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_financial_milestones.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_financial_milestones.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_consent_forms
DROP POLICY IF EXISTS "Auth users manage consent" ON public.ortho_consent_forms;
CREATE POLICY "Clinic staff manage consent" ON public.ortho_consent_forms
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_consent_forms.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_consent_forms.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_debond_records
DROP POLICY IF EXISTS "Auth users manage debond" ON public.ortho_debond_records;
CREATE POLICY "Clinic staff manage debond" ON public.ortho_debond_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_debond_records.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_debond_records.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));

-- ortho_ipr_log
DROP POLICY IF EXISTS "Auth users manage IPR" ON public.ortho_ipr_log;
CREATE POLICY "Clinic staff manage IPR" ON public.ortho_ipr_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_ipr_log.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ortho_cases WHERE ortho_cases.id = ortho_ipr_log.ortho_case_id AND ortho_cases.clinic_id = get_user_clinic_id()));
