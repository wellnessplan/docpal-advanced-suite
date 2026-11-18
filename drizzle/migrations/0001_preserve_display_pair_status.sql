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
  SET is_paired = true,
      last_seen_at = now(),
      app_version = left(coalesce(p_app_version, ''), 50),
      last_error = CASE WHEN p_error IS NULL THEN last_error ELSE left(p_error, 500) END,
      last_error_at = CASE WHEN p_error IS NULL THEN last_error_at ELSE now() END
  WHERE pair_code = upper(btrim(p_pair_code));
END;
$$;
REVOKE ALL ON FUNCTION public.touch_display_screen_by_pair_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_display_screen_by_pair_code(text, text, text) TO anon, authenticated;