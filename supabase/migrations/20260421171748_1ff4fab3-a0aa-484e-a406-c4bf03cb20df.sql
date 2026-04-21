
-- 1) Social posts
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by uuid,
  platforms text[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz NOT NULL,
  caption text NOT NULL DEFAULT '',
  hashtags text,
  image_url text,
  campaign_name text,
  cta_link text,
  target_audience text,
  boost_budget numeric DEFAULT 0,
  notes text,
  approval_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members manage social posts"
ON public.social_posts FOR ALL
TO authenticated
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_social_posts_clinic_date ON public.social_posts(clinic_id, scheduled_at);
CREATE INDEX idx_social_posts_status ON public.social_posts(clinic_id, status);

-- 2) Social webhooks (per platform)
CREATE TABLE public.social_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  platform text NOT NULL,
  webhook_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, platform)
);

ALTER TABLE public.social_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members manage social webhooks"
ON public.social_webhooks FOR ALL
TO authenticated
USING (clinic_id = public.get_user_clinic_id())
WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE TRIGGER social_webhooks_updated_at
BEFORE UPDATE ON public.social_webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Posting history
CREATE TABLE public.social_post_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  platform text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_post_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members view post history"
ON public.social_post_history FOR SELECT
TO authenticated
USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Clinic members insert post history"
ON public.social_post_history FOR INSERT
TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id());

CREATE INDEX idx_social_post_history_post ON public.social_post_history(post_id);
