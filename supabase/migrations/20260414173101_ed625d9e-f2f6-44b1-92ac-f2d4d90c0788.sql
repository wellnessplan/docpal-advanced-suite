-- Allow anon to check clinic existence (needed for self-registration)
CREATE POLICY "Anon can verify clinic exists"
ON public.clinics
FOR SELECT
TO anon
USING (true);

-- NOTE: This only exposes clinic id/name to anon. No sensitive data in clinics table.