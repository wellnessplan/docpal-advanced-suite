-- Make sure each clinic only has one pricing row per treatment name (case-insensitive)
-- so bulk import upserts work and edits don't create duplicates.

-- First, deduplicate any existing duplicates: keep the most recently updated row.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY clinic_id, lower(treatment_name)
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.treatment_pricing
)
DELETE FROM public.treatment_pricing
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add unique index (case-insensitive) so onConflict upsert and ON CONFLICT work.
CREATE UNIQUE INDEX IF NOT EXISTS treatment_pricing_clinic_name_unique
  ON public.treatment_pricing (clinic_id, lower(treatment_name));

-- Also add a non-unique helpful btree for fast lookup by exact name.
CREATE INDEX IF NOT EXISTS treatment_pricing_clinic_name_idx
  ON public.treatment_pricing (clinic_id, treatment_name);