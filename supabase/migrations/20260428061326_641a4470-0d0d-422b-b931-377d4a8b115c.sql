
-- 1. Operatories (chairs/rooms)
CREATE TABLE IF NOT EXISTS public.operatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  label text NOT NULL,
  color text DEFAULT '#7DD3FC',
  display_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff view operatories" ON public.operatories FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff insert operatories" ON public.operatories FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff update operatories" ON public.operatories FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff delete operatories" ON public.operatories FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE TRIGGER trg_operatories_updated BEFORE UPDATE ON public.operatories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Appointments operatory link
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS operatory_id uuid;
CREATE INDEX IF NOT EXISTS idx_appointments_operatory ON public.appointments(operatory_id);

-- 3. Periodontal charts
CREATE TABLE IF NOT EXISTS public.perio_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  chart_date date NOT NULL DEFAULT CURRENT_DATE,
  tooth_number integer NOT NULL,
  -- 6 sites: distobuccal, buccal, mesiobuccal, distolingual, lingual, mesiolingual
  pd_db smallint, pd_b smallint, pd_mb smallint,
  pd_dl smallint, pd_l smallint, pd_ml smallint,
  recession_b smallint, recession_l smallint,
  bop_db boolean DEFAULT false, bop_b boolean DEFAULT false, bop_mb boolean DEFAULT false,
  bop_dl boolean DEFAULT false, bop_l boolean DEFAULT false, bop_ml boolean DEFAULT false,
  mobility smallint, -- 0/1/2/3
  furcation smallint, -- 0/1/2/3
  plaque boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_perio_chart_per_tooth_date ON public.perio_charts(patient_id, chart_date, tooth_number);
ALTER TABLE public.perio_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff view perio" ON public.perio_charts FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff insert perio" ON public.perio_charts FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff update perio" ON public.perio_charts FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff delete perio" ON public.perio_charts FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE TRIGGER trg_perio_updated BEFORE UPDATE ON public.perio_charts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Endodontic charts
CREATE TABLE IF NOT EXISTS public.endo_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  tooth_number integer NOT NULL,
  access_date date NOT NULL DEFAULT CURRENT_DATE,
  pulp_diagnosis text,
  periapical_diagnosis text,
  -- canals: jsonb array [{name:'MB', working_length:21.5, apical_file:'F2', taper:'.04', obturation:'Gutta-percha', notes:''}]
  canals jsonb NOT NULL DEFAULT '[]'::jsonb,
  irrigants text,
  sealer text,
  obturation_technique text,
  status text DEFAULT 'in_progress', -- in_progress | completed | retreatment
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_endo_patient ON public.endo_charts(patient_id);
ALTER TABLE public.endo_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff view endo" ON public.endo_charts FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff insert endo" ON public.endo_charts FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff update endo" ON public.endo_charts FOR UPDATE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Clinic staff delete endo" ON public.endo_charts FOR DELETE TO authenticated USING (clinic_id = get_user_clinic_id());
CREATE TRIGGER trg_endo_updated BEFORE UPDATE ON public.endo_charts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
