DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.platform_settings;
CREATE POLICY "Super admins read settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;

CREATE OR REPLACE FUNCTION public.get_public_registration_settings(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'welcome_heading', s.welcome_heading,
    'welcome_subheading', s.welcome_subheading,
    'banner_image_url', s.banner_image_url,
    'brand_color', s.brand_color,
    'thank_you_heading', s.thank_you_heading,
    'thank_you_message', s.thank_you_message,
    'show_logo', s.show_logo,
    'action_links', s.action_links,
    'require_phone_verification', s.require_phone_verification
  )
  FROM public.clinic_registration_settings AS s
  WHERE s.clinic_id = p_clinic_id
    AND EXISTS (SELECT 1 FROM public.clinics AS c WHERE c.id = p_clinic_id)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_registration_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_registration_settings(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public read by pair code" ON public.display_screens;
DROP POLICY IF EXISTS "Public heartbeat update" ON public.display_screens;
REVOKE UPDATE (last_seen_at, is_paired, app_version, last_error, last_error_at) ON public.display_screens FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_display_screen(p_pair_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'clinic_id', s.clinic_id,
    'name', s.name,
    'zone', s.zone,
    'is_playing', s.is_playing,
    'volume', s.volume,
    'show_lower_third', s.show_lower_third,
    'show_queue', s.show_queue,
    'current_video_id', s.current_video_id,
    'current_playlist_id', s.current_playlist_id,
    'command_at', s.command_at,
    'command', CASE
      WHEN s.command->>'type' IN ('reload', 'restart', 'clear_cache', 'update')
      THEN jsonb_build_object('type', s.command->>'type')
      ELSE NULL
    END,
    'lower_third_show_at_sec', s.lower_third_show_at_sec,
    'lower_third_hide_at_sec', s.lower_third_hide_at_sec
  )
  FROM public.display_screens AS s
  WHERE s.pair_code = upper(btrim(p_pair_code))
    AND length(btrim(p_pair_code)) = 6
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_display_screen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_display_screen(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_display_screen_by_pair_code(
  p_pair_code text,
  p_app_version text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pair_code IS NULL OR length(btrim(p_pair_code)) <> 6 THEN
    RETURN;
  END IF;

  UPDATE public.display_screens
  SET last_seen_at = now(),
      app_version = left(coalesce(p_app_version, ''), 50),
      last_error = CASE WHEN p_error IS NULL THEN last_error ELSE left(p_error, 500) END,
      last_error_at = CASE WHEN p_error IS NULL THEN last_error_at ELSE now() END
  WHERE pair_code = upper(btrim(p_pair_code));
END;
$$;
REVOKE ALL ON FUNCTION public.touch_display_screen_by_pair_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_display_screen_by_pair_code(text, text, text) TO anon, authenticated;