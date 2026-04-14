
-- Allow anon/public role to insert patients (for dev bypass mode)
CREATE POLICY "Public can insert patients" ON public.patients
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can view patients" ON public.patients
FOR SELECT TO public USING (true);

CREATE POLICY "Public can update patients" ON public.patients
FOR UPDATE TO public USING (true);

CREATE POLICY "Public can delete patients" ON public.patients
FOR DELETE TO public USING (true);

-- Allow anon/public role to insert appointments (for booking during registration)
CREATE POLICY "Public can insert appointments" ON public.appointments
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can view appointments" ON public.appointments
FOR SELECT TO public USING (true);

CREATE POLICY "Public can update appointments" ON public.appointments
FOR UPDATE TO public USING (true);
