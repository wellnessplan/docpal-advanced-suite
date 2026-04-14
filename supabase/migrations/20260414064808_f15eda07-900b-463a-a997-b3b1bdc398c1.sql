
-- Dev bypass for payments
CREATE POLICY "Dev bypass insert payments" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Dev bypass select payments" ON public.payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dev bypass update payments" ON public.payments FOR UPDATE TO anon, authenticated USING (true);

-- Dev bypass for lab_orders
CREATE POLICY "Dev bypass insert lab_orders" ON public.lab_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Dev bypass select lab_orders" ON public.lab_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dev bypass update lab_orders" ON public.lab_orders FOR UPDATE TO anon, authenticated USING (true);
