
ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS tpa_id uuid REFERENCES public.tpa_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_id text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_auth_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS treatment_summary text,
  ADD COLUMN IF NOT EXISTS diagnosis_codes text[],
  ADD COLUMN IF NOT EXISTS procedure_codes text[],
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;
