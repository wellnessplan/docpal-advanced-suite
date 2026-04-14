
-- =============================================
-- 1. DROP ALL DANGEROUS PUBLIC-ACCESS POLICIES
-- =============================================

-- clinic_settings: remove "Anyone can ..." policies
DROP POLICY IF EXISTS "Anyone can view clinic settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Anyone can insert clinic settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Anyone can update clinic settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Anyone can delete clinic settings" ON public.clinic_settings;

-- daily_todos: remove "Anyone can ..." policies (keep clinic-scoped ones)
DROP POLICY IF EXISTS "Anyone can view daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Anyone can insert daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Anyone can update daily_todos" ON public.daily_todos;
DROP POLICY IF EXISTS "Anyone can delete daily_todos" ON public.daily_todos;

-- discount_coupons: remove "Anyone can ..." policies
DROP POLICY IF EXISTS "Anyone can view discount_coupons" ON public.discount_coupons;
DROP POLICY IF EXISTS "Anyone can insert discount_coupons" ON public.discount_coupons;
DROP POLICY IF EXISTS "Anyone can update discount_coupons" ON public.discount_coupons;
DROP POLICY IF EXISTS "Anyone can delete discount_coupons" ON public.discount_coupons;

-- appointments: remove public-role policies (keep authenticated ones)
DROP POLICY IF EXISTS "Public can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can update appointments" ON public.appointments;

-- consent_forms: fix role from public to authenticated
DROP POLICY IF EXISTS "Clinic staff can view consent forms" ON public.consent_forms;
DROP POLICY IF EXISTS "Clinic staff can insert consent forms" ON public.consent_forms;

-- doctor_chairs: fix role from public to authenticated
DROP POLICY IF EXISTS "Clinic staff can view chairs" ON public.doctor_chairs;
DROP POLICY IF EXISTS "Clinic staff can insert chairs" ON public.doctor_chairs;
DROP POLICY IF EXISTS "Clinic staff can update chairs" ON public.doctor_chairs;
DROP POLICY IF EXISTS "Clinic staff can delete chairs" ON public.doctor_chairs;

-- =============================================
-- 2. CREATE PROPER POLICIES
-- =============================================

-- clinic_settings: authenticated, clinic-scoped
CREATE POLICY "Clinic staff can view settings" ON public.clinic_settings
  FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert settings" ON public.clinic_settings
  FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update settings" ON public.clinic_settings
  FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete settings" ON public.clinic_settings
  FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- discount_coupons: authenticated, clinic-scoped
CREATE POLICY "Clinic staff can view coupons" ON public.discount_coupons
  FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert coupons" ON public.discount_coupons
  FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update coupons" ON public.discount_coupons
  FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete coupons" ON public.discount_coupons
  FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- consent_forms: fix to authenticated
CREATE POLICY "Clinic staff can view consent forms" ON public.consent_forms
  FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert consent forms" ON public.consent_forms
  FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update consent forms" ON public.consent_forms
  FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());

-- doctor_chairs: fix to authenticated
CREATE POLICY "Clinic staff can view chairs" ON public.doctor_chairs
  FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert chairs" ON public.doctor_chairs
  FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update chairs" ON public.doctor_chairs
  FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete chairs" ON public.doctor_chairs
  FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- =============================================
-- 3. USER ROLES TABLE + has_role FUNCTION
-- =============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
