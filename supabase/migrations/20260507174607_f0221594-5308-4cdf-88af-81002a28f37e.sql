
-- ============================================================
-- PHASE 1: Multi-Branch Foundation
-- ============================================================

-- 1. clinic_groups table
CREATE TABLE IF NOT EXISTS public.clinic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_clinic_groups_updated_at
BEFORE UPDATE ON public.clinic_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add group_id to clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.clinic_groups(id) ON DELETE SET NULL;

-- 3. Backfill: each existing clinic becomes its own group
DO $$
DECLARE
  c RECORD;
  v_owner uuid;
  v_group uuid;
BEGIN
  FOR c IN SELECT id, name FROM public.clinics WHERE group_id IS NULL LOOP
    -- find an owner (first profile linked to this clinic, prefer admin)
    SELECT user_id INTO v_owner
    FROM public.profiles
    WHERE clinic_id = c.id
    ORDER BY created_at ASC
    LIMIT 1;

    -- if no profile found, skip; will be backfilled when a user joins
    IF v_owner IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.clinic_groups (name, owner_user_id)
    VALUES (COALESCE(c.name, 'My Clinic') || ' Group', v_owner)
    RETURNING id INTO v_group;

    UPDATE public.clinics SET group_id = v_group WHERE id = c.id;
  END LOOP;
END $$;

-- 4. Add group_id to shared-scope tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS group_id uuid;

-- treatment_catalog may or may not exist; guard with DO block
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='treatment_catalog') THEN
    EXECUTE 'ALTER TABLE public.treatment_catalog ADD COLUMN IF NOT EXISTS group_id uuid';
    EXECUTE 'UPDATE public.treatment_catalog tc SET group_id = c.group_id FROM public.clinics c WHERE tc.clinic_id = c.id AND tc.group_id IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_treatment_catalog_group ON public.treatment_catalog(group_id)';
  END IF;
END $$;

-- Backfill from clinics
UPDATE public.profiles p SET group_id = c.group_id FROM public.clinics c WHERE p.clinic_id = c.id AND p.group_id IS NULL;
UPDATE public.patients p SET group_id = c.group_id FROM public.clinics c WHERE p.clinic_id = c.id AND p.group_id IS NULL;
UPDATE public.inventory_items i SET group_id = c.group_id FROM public.clinics c WHERE i.clinic_id = c.id AND i.group_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinics_group ON public.clinics(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_group ON public.profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_patients_group ON public.patients(group_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_group ON public.inventory_items(group_id);

-- 5. Helper function: get current user's group_id
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT group_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 6. Helper: is user the owner of a group
CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_groups
    WHERE id = _group_id AND owner_user_id = auth.uid()
  )
$$;

-- 7. RLS for clinic_groups
DROP POLICY IF EXISTS "Group members can view their group" ON public.clinic_groups;
CREATE POLICY "Group members can view their group"
ON public.clinic_groups FOR SELECT
USING (id = public.get_user_group_id() OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their group" ON public.clinic_groups;
CREATE POLICY "Owners can update their group"
ON public.clinic_groups FOR UPDATE
USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create a group" ON public.clinic_groups;
CREATE POLICY "Authenticated users can create a group"
ON public.clinic_groups FOR INSERT
WITH CHECK (owner_user_id = auth.uid());

-- 8. RPC: create a new branch within an existing group
CREATE OR REPLACE FUNCTION public.create_branch_in_group(
  p_group_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  IF NOT public.is_group_owner(p_group_id) THEN
    RAISE EXCEPTION 'Only group owners can add branches';
  END IF;

  INSERT INTO public.clinics (name, phone, address, email, group_id)
  VALUES (p_name, p_phone, p_address, p_email, p_group_id)
  RETURNING id INTO v_clinic_id;

  RETURN v_clinic_id;
END;
$$;

-- 9. RPC: switch active branch (updates profiles.clinic_id)
CREATE OR REPLACE FUNCTION public.switch_active_branch(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
  v_user_group uuid;
BEGIN
  SELECT group_id INTO v_group_id FROM public.clinics WHERE id = p_clinic_id;
  SELECT group_id INTO v_user_group FROM public.profiles WHERE user_id = auth.uid();

  IF v_group_id IS NULL OR v_group_id IS DISTINCT FROM v_user_group THEN
    RAISE EXCEPTION 'You do not have access to this branch';
  END IF;

  UPDATE public.profiles
  SET clinic_id = p_clinic_id, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- 10. Update create_clinic_for_user to also create a group
CREATE OR REPLACE FUNCTION public.create_clinic_for_user(
  p_name text,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_clinic_id uuid;
  new_group_id uuid;
BEGIN
  INSERT INTO public.clinic_groups (name, owner_user_id)
  VALUES (COALESCE(p_name, 'My Clinic') || ' Group', auth.uid())
  RETURNING id INTO new_group_id;

  INSERT INTO public.clinics (name, phone, address, email, group_id)
  VALUES (p_name, p_phone, p_address, p_email, new_group_id)
  RETURNING id INTO new_clinic_id;

  UPDATE public.profiles
  SET clinic_id = new_clinic_id, group_id = new_group_id
  WHERE user_id = auth.uid();

  RETURN new_clinic_id;
END;
$$;
