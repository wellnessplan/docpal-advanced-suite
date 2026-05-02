-- Add 2 new lower-third styles
ALTER TABLE public.display_branding DROP CONSTRAINT IF EXISTS display_branding_lower_third_style_check;
ALTER TABLE public.display_branding ADD CONSTRAINT display_branding_lower_third_style_check
  CHECK (lower_third_style = ANY (ARRAY['broadcast','minimal','news','cinema','spotlight','sidebar']));

-- Presets table: save (style + video + branding override + timing) combos
CREATE TABLE public.lower_third_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  style text NOT NULL DEFAULT 'broadcast'
    CHECK (style = ANY (ARRAY['broadcast','minimal','news','cinema','spotlight','sidebar'])),
  video_id uuid REFERENCES public.education_videos(id) ON DELETE SET NULL,
  branding_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  show_at_sec integer NOT NULL DEFAULT 0,    -- 0 = always show from start
  hide_at_sec integer,                        -- null = never auto-hide
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lower_third_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic manages presets" ON public.lower_third_presets
  FOR ALL USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Public read presets" ON public.lower_third_presets FOR SELECT USING (true);

CREATE TRIGGER tg_lt_presets_updated BEFORE UPDATE ON public.lower_third_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lt_presets_clinic ON public.lower_third_presets(clinic_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.lower_third_presets;

-- Add timing columns to display_screens so a "Send preview" can include timestamps
ALTER TABLE public.display_screens
  ADD COLUMN IF NOT EXISTS lower_third_show_at_sec integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lower_third_hide_at_sec integer;