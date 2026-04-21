
-- Add analytics fields to social_posts
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement integer NOT NULL DEFAULT 0;

-- Per-platform analytics table
CREATE TABLE IF NOT EXISTS public.social_post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  platform text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  engagement integer NOT NULL DEFAULT 0,
  webhook_status text,
  webhook_status_code integer,
  webhook_fired_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_spa_clinic ON public.social_post_analytics(clinic_id);
CREATE INDEX IF NOT EXISTS idx_spa_post ON public.social_post_analytics(post_id);

ALTER TABLE public.social_post_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members manage analytics" ON public.social_post_analytics;
CREATE POLICY "Clinic members manage analytics" ON public.social_post_analytics
  FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id())
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE TRIGGER spa_updated_at BEFORE UPDATE ON public.social_post_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for social media assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read social-media" ON storage.objects;
CREATE POLICY "Public read social-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Auth upload social-media" ON storage.objects;
CREATE POLICY "Auth upload social-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Auth update social-media" ON storage.objects;
CREATE POLICY "Auth update social-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Auth delete social-media" ON storage.objects;
CREATE POLICY "Auth delete social-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'social-media');
