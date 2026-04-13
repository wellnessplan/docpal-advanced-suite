
-- Vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view vendors" ON public.vendors FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can update vendors" ON public.vendors FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff can delete vendors" ON public.vendors FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());

-- Inventory transactions table
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL DEFAULT 'restock',
  quantity_changed NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view transactions" ON public.inventory_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM inventory_items WHERE inventory_items.id = inventory_transactions.inventory_item_id AND inventory_items.clinic_id = get_user_clinic_id()));
CREATE POLICY "Clinic staff can insert transactions" ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM inventory_items WHERE inventory_items.id = inventory_transactions.inventory_item_id AND inventory_items.clinic_id = get_user_clinic_id()));
