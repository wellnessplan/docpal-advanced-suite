
-- ============================================================
-- PHASE 2: Insurance / TPA Claims
-- ============================================================

-- 1. TPA providers directory
CREATE TABLE IF NOT EXISTS public.tpa_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  payment_terms_days integer DEFAULT 30,
  claim_form_template text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tpa_providers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tpa_providers_clinic ON public.tpa_providers(clinic_id);
CREATE TRIGGER trg_tpa_providers_updated_at BEFORE UPDATE ON public.tpa_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic staff manage TPA providers"
ON public.tpa_providers FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- 2. Insurance claims
CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  tpa_id uuid REFERENCES public.tpa_providers(id) ON DELETE SET NULL,
  invoice_id uuid,
  claim_number text,
  policy_number text,
  member_id text,
  claim_amount numeric(12,2) NOT NULL DEFAULT 0,
  approved_amount numeric(12,2),
  paid_amount numeric(12,2) DEFAULT 0,
  pre_auth_required boolean DEFAULT false,
  pre_auth_amount numeric(12,2),
  pre_auth_status text,
  status text NOT NULL DEFAULT 'draft',
    -- draft / pre_auth_pending / pre_auth_approved / submitted /
    -- under_review / approved / partially_approved / rejected / paid / appealed
  treatment_summary text,
  diagnosis_codes text[],
  procedure_codes text[],
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_insurance_claims_clinic ON public.insurance_claims(clinic_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON public.insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE TRIGGER trg_insurance_claims_updated_at BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic staff manage insurance claims"
ON public.insurance_claims FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Auto claim_number per clinic
CREATE SEQUENCE IF NOT EXISTS insurance_claim_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.claim_number IS NULL OR NEW.claim_number = '' THEN
    NEW.claim_number := 'CLM-' || LPAD(nextval('insurance_claim_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_claim_number
BEFORE INSERT ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.generate_claim_number();

-- 3. Claim documents
CREATE TABLE IF NOT EXISTS public.insurance_claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text,
  doc_type text, -- xray / treatment_notes / consent / prescription / invoice / other
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_claim_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_claim_docs_claim ON public.insurance_claim_documents(claim_id);

CREATE POLICY "Clinic staff manage claim documents"
ON public.insurance_claim_documents FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- 4. Claim history (audit)
CREATE TABLE IF NOT EXISTS public.insurance_claim_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_claim_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_claim_history_claim ON public.insurance_claim_history(claim_id);

CREATE POLICY "Clinic staff view claim history"
ON public.insurance_claim_history FOR SELECT
USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic staff insert claim history"
ON public.insurance_claim_history FOR INSERT
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- PHASE 3: Suppliers + Purchase Orders + Auto-PO
-- ============================================================

-- 5. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  whatsapp_number text,
  address text,
  payment_terms_days integer DEFAULT 30,
  lead_time_days integer DEFAULT 7,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  preferred_channel text DEFAULT 'whatsapp', -- whatsapp / email
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_suppliers_clinic ON public.suppliers(clinic_id);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic staff manage suppliers"
ON public.suppliers FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- 6. Add supplier link & reorder qty to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reorder_quantity integer DEFAULT 10;

-- 7. Purchase orders
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START 1;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text,
  status text NOT NULL DEFAULT 'draft',
    -- draft / sent / partially_received / received / cancelled
  total_amount numeric(12,2) DEFAULT 0,
  notes text,
  auto_generated boolean NOT NULL DEFAULT false,
  created_by uuid,
  sent_at timestamptz,
  sent_via text, -- whatsapp / email / manual
  received_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_po_clinic ON public.purchase_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Clinic staff manage POs"
ON public.purchase_orders FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || LPAD(nextval('purchase_order_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_po_number
BEFORE INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();

-- 8. PO line items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(10,2) NOT NULL,
  quantity_received numeric(10,2) DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_poi_po ON public.purchase_order_items(po_id);

CREATE POLICY "Clinic staff manage PO items"
ON public.purchase_order_items FOR ALL
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

-- 9. RPC: generate draft POs from low-stock items
CREATE OR REPLACE FUNCTION public.generate_draft_pos_from_low_stock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clinic_id uuid := public.get_user_clinic_id();
  v_supplier_id uuid;
  v_po_id uuid;
  v_pos_created integer := 0;
  v_items_added integer := 0;
  rec RECORD;
BEGIN
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'No clinic context'; END IF;

  FOR v_supplier_id IN
    SELECT DISTINCT preferred_supplier_id
    FROM public.inventory_items
    WHERE clinic_id = v_clinic_id
      AND quantity <= min_stock_level
      AND preferred_supplier_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.clinic_id = v_clinic_id
          AND po.supplier_id = inventory_items.preferred_supplier_id
          AND po.status = 'draft'
          AND po.created_at > now() - interval '24 hours'
      )
  LOOP
    INSERT INTO public.purchase_orders (clinic_id, supplier_id, status, auto_generated, notes)
    VALUES (v_clinic_id, v_supplier_id, 'draft', true, 'Auto-generated from low-stock alert')
    RETURNING id INTO v_po_id;
    v_pos_created := v_pos_created + 1;

    INSERT INTO public.purchase_order_items (po_id, clinic_id, inventory_item_id, item_name, quantity, unit_cost)
    SELECT v_po_id, v_clinic_id, i.id, i.name,
           GREATEST(COALESCE(i.reorder_quantity, 10), (i.min_stock_level * 2 - i.quantity)),
           COALESCE(i.unit_cost, 0)
    FROM public.inventory_items i
    WHERE i.clinic_id = v_clinic_id
      AND i.quantity <= i.min_stock_level
      AND i.preferred_supplier_id = v_supplier_id;

    GET DIAGNOSTICS v_items_added = ROW_COUNT;

    UPDATE public.purchase_orders
    SET total_amount = (SELECT COALESCE(SUM(line_total),0) FROM public.purchase_order_items WHERE po_id = v_po_id)
    WHERE id = v_po_id;
  END LOOP;

  RETURN jsonb_build_object('pos_created', v_pos_created, 'success', true);
END;
$$;

-- 10. RPC: receive PO (restock inventory)
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clinic_id uuid;
  rec RECORD;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.purchase_orders WHERE id = p_po_id;
  IF v_clinic_id IS DISTINCT FROM public.get_user_clinic_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOR rec IN
    SELECT inventory_item_id, quantity, unit_cost
    FROM public.purchase_order_items
    WHERE po_id = p_po_id AND inventory_item_id IS NOT NULL
  LOOP
    UPDATE public.inventory_items
    SET quantity = quantity + rec.quantity, updated_at = now()
    WHERE id = rec.inventory_item_id;

    INSERT INTO public.inventory_transactions (inventory_item_id, transaction_type, quantity_changed, notes)
    VALUES (rec.inventory_item_id, 'restock', rec.quantity, 'Received via PO');
  END LOOP;

  UPDATE public.purchase_orders
  SET status = 'received', received_at = now()
  WHERE id = p_po_id;
END;
$$;
