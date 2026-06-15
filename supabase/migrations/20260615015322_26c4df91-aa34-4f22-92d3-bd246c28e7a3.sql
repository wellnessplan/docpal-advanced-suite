
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS recycle_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recycle_interval_weeks int NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS last_recycled_at timestamptz,
  ADD COLUMN IF NOT EXISTS recycle_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_post_id uuid;

CREATE INDEX IF NOT EXISTS idx_social_posts_recycle
  ON public.social_posts (clinic_id, recycle_enabled, last_recycled_at)
  WHERE recycle_enabled = true;

-- Aggregate top engagement times per platform from analytics + posts
CREATE OR REPLACE FUNCTION public.suggest_best_post_times(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_clinic_id IS DISTINCT FROM public.get_user_clinic_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH joined AS (
    SELECT
      a.platform,
      EXTRACT(dow  FROM p.scheduled_at AT TIME ZONE 'Asia/Kolkata')::int  AS dow,
      EXTRACT(hour FROM p.scheduled_at AT TIME ZONE 'Asia/Kolkata')::int  AS hr,
      COALESCE(a.engagement, 0) + COALESCE(a.clicks, 0) AS score,
      COALESCE(a.impressions, 0) AS imp
    FROM public.social_post_analytics a
    JOIN public.social_posts p ON p.id = a.post_id
    WHERE a.clinic_id = p_clinic_id AND p.posted_at IS NOT NULL
  ),
  ranked AS (
    SELECT platform, dow, hr,
           SUM(score)::numeric AS total_score,
           SUM(imp)::numeric AS total_imp,
           COUNT(*) AS samples
    FROM joined
    GROUP BY platform, dow, hr
  ),
  top_per_platform AS (
    SELECT DISTINCT ON (platform)
      platform, dow, hr, total_score, samples,
      CASE WHEN total_imp > 0 THEN round((total_score / total_imp) * 100, 2) ELSE NULL END AS engagement_rate_pct
    FROM ranked
    ORDER BY platform, total_score DESC, samples DESC
  )
  SELECT jsonb_agg(jsonb_build_object(
    'platform', platform,
    'weekday', dow,
    'hour', hr,
    'score', total_score,
    'samples', samples,
    'engagement_rate_pct', engagement_rate_pct
  ) ORDER BY total_score DESC)
  INTO v_result
  FROM top_per_platform;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_best_post_times(uuid) TO authenticated;

-- Clone an evergreen post for the recycle cron
CREATE OR REPLACE FUNCTION public.clone_social_post_for_recycle(p_post_id uuid, p_new_scheduled_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.social_posts%ROWTYPE;
  v_new_id uuid;
  v_source uuid;
BEGIN
  SELECT * INTO v_orig FROM public.social_posts WHERE id = p_post_id;
  IF v_orig.id IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  v_source := COALESCE(v_orig.source_post_id, v_orig.id);

  INSERT INTO public.social_posts (
    clinic_id, created_by, platforms, scheduled_at, caption, hashtags,
    image_url, media_url, media_urls, media_type, media_kind,
    campaign_name, cta_link, target_audience, boost_budget, notes,
    approval_status, status, source_post_id
  ) VALUES (
    v_orig.clinic_id, v_orig.created_by, v_orig.platforms, p_new_scheduled_at, v_orig.caption, v_orig.hashtags,
    v_orig.image_url, v_orig.media_url, v_orig.media_urls, v_orig.media_type, v_orig.media_kind,
    v_orig.campaign_name, v_orig.cta_link, v_orig.target_audience, v_orig.boost_budget,
    COALESCE(v_orig.notes, '') || E'\n[Recycled from evergreen post]',
    'approved', 'scheduled', v_source
  ) RETURNING id INTO v_new_id;

  UPDATE public.social_posts
  SET last_recycled_at = now(), recycle_count = recycle_count + 1
  WHERE id = v_source;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_social_post_for_recycle(uuid, timestamptz) TO authenticated, service_role;
