
-- 1. Fix prescriptions: drop ALL existing policies, recreate secure ones
DROP POLICY IF EXISTS "Dev public access prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Anyone can read prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Anyone can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Anyone can update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Anyone can delete prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic staff can view prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic staff can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic staff can update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic staff can delete prescriptions" ON public.prescriptions;

CREATE POLICY "Clinic staff can view prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert prescriptions"
ON public.prescriptions FOR INSERT TO authenticated
WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update prescriptions"
ON public.prescriptions FOR UPDATE TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete prescriptions"
ON public.prescriptions FOR DELETE TO authenticated
USING (clinic_id = get_user_clinic_id());

-- 2. Fix prescription_items
DROP POLICY IF EXISTS "Dev public access prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "Anyone can read prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "Anyone can insert prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "Anyone can update prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "Anyone can delete prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "Clinic staff can view prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Clinic staff can insert prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Clinic staff can update prescription items" ON public.prescription_items;
DROP POLICY IF EXISTS "Clinic staff can delete prescription items" ON public.prescription_items;

CREATE POLICY "Clinic staff can view prescription items"
ON public.prescription_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_items.prescription_id AND p.clinic_id = get_user_clinic_id()));

CREATE POLICY "Clinic staff can insert prescription items"
ON public.prescription_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_items.prescription_id AND p.clinic_id = get_user_clinic_id()));

CREATE POLICY "Clinic staff can update prescription items"
ON public.prescription_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_items.prescription_id AND p.clinic_id = get_user_clinic_id()));

CREATE POLICY "Clinic staff can delete prescription items"
ON public.prescription_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_items.prescription_id AND p.clinic_id = get_user_clinic_id()));

-- 3. Fix queue_tokens
DROP POLICY IF EXISTS "Anyone can view queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Anyone can insert queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Anyone can update queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Anyone can delete queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Dev public access queue_tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can view queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can insert queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can update queue tokens" ON public.queue_tokens;
DROP POLICY IF EXISTS "Clinic staff can delete queue tokens" ON public.queue_tokens;

CREATE POLICY "Clinic staff can view queue tokens"
ON public.queue_tokens FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert queue tokens"
ON public.queue_tokens FOR INSERT TO authenticated
WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update queue tokens"
ON public.queue_tokens FOR UPDATE TO authenticated
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete queue tokens"
ON public.queue_tokens FOR DELETE TO authenticated
USING (clinic_id = get_user_clinic_id());

-- 4. Fix deduct_inventory with clinic check
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_item_id uuid, p_quantity numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.inventory_items WHERE id = p_item_id;
  IF v_clinic_id IS DISTINCT FROM public.get_user_clinic_id() THEN
    RAISE EXCEPTION 'Access denied: inventory item does not belong to your clinic';
  END IF;
  UPDATE public.inventory_items
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE id = p_item_id AND quantity >= p_quantity;
END;
$$;
