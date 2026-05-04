
ALTER TABLE public.display_branding
  ADD COLUMN IF NOT EXISTS banner_x numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS banner_y numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS banner_scale numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS banner_fit text DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS banner_opacity numeric DEFAULT 1;
