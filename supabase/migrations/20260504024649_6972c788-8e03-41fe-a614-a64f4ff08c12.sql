
ALTER TABLE public.lower_third_presets
  ADD COLUMN IF NOT EXISTS banner_x numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS banner_y numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS banner_scale numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS banner_fit text DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS banner_opacity numeric DEFAULT 1;

ALTER TABLE public.display_screens
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
