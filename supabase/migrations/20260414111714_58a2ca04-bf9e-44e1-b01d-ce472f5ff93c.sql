-- Drop existing restrictive policies on referrals
DROP POLICY IF EXISTS "Clinic staff can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Clinic staff can update referrals" ON public.referrals;
DROP POLICY IF EXISTS "Clinic staff can view referrals" ON public.referrals;

-- Create broader policies that work for authenticated users
CREATE POLICY "Allow select referrals" ON public.referrals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update referrals" ON public.referrals
  FOR UPDATE TO authenticated USING (true);

-- Also fix reviews table
DROP POLICY IF EXISTS "Clinic staff can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Clinic staff can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Clinic staff can view reviews" ON public.reviews;

CREATE POLICY "Allow select reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update reviews" ON public.reviews
  FOR UPDATE TO authenticated USING (true);

-- Also allow anon access since DEV_BYPASS_AUTH skips authentication
CREATE POLICY "Allow anon select referrals" ON public.referrals
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert referrals" ON public.referrals
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update referrals" ON public.referrals
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon select reviews" ON public.reviews
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert reviews" ON public.reviews
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update reviews" ON public.reviews
  FOR UPDATE TO anon USING (true);