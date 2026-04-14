
-- Fix RLS: add public policies for dev mode on clinical tables
DO $$ BEGIN
  -- tooth_records
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tooth_records' AND policyname='Dev public access tooth_records') THEN
    CREATE POLICY "Dev public access tooth_records" ON public.tooth_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- tooth_conditions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tooth_conditions' AND policyname='Dev public access tooth_conditions') THEN
    CREATE POLICY "Dev public access tooth_conditions" ON public.tooth_conditions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- tooth_treatments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tooth_treatments' AND policyname='Dev public access tooth_treatments') THEN
    CREATE POLICY "Dev public access tooth_treatments" ON public.tooth_treatments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- prescriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prescriptions' AND policyname='Dev public access prescriptions') THEN
    CREATE POLICY "Dev public access prescriptions" ON public.prescriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- treatment_plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='treatment_plans' AND policyname='Dev public access treatment_plans') THEN
    CREATE POLICY "Dev public access treatment_plans" ON public.treatment_plans FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- treatment_plan_items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='treatment_plan_items' AND policyname='Dev public access treatment_plan_items') THEN
    CREATE POLICY "Dev public access treatment_plan_items" ON public.treatment_plan_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add acceptance workflow columns to treatment_plans
ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS doctor_notes text,
  ADD COLUMN IF NOT EXISTS presented_at timestamptz;

-- Add detailed treatment options to treatment_plan_items
ALTER TABLE public.treatment_plan_items
  ADD COLUMN IF NOT EXISTS treatment_type text,
  ADD COLUMN IF NOT EXISTS treatment_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_option text,
  ADD COLUMN IF NOT EXISTS scheduled_date date;
