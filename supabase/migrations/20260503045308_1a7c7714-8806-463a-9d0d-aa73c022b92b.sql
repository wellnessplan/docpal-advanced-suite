-- Support images alongside videos in education library
ALTER TABLE public.education_videos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';

ALTER TABLE public.education_videos
  DROP CONSTRAINT IF EXISTS education_videos_media_type_check;
ALTER TABLE public.education_videos
  ADD CONSTRAINT education_videos_media_type_check CHECK (media_type IN ('video','image'));

-- Lower-third image banner (per preset + per clinic default)
ALTER TABLE public.lower_third_presets
  ADD COLUMN IF NOT EXISTS banner_image_url text;

ALTER TABLE public.display_branding
  ADD COLUMN IF NOT EXISTS banner_image_url text;

-- Allow new "image" style for lower-third (uses an uploaded banner)
ALTER TABLE public.lower_third_presets
  DROP CONSTRAINT IF EXISTS lower_third_presets_style_check;
ALTER TABLE public.lower_third_presets
  ADD CONSTRAINT lower_third_presets_style_check
  CHECK (style IN ('broadcast','minimal','news','cinema','spotlight','sidebar','image'));

ALTER TABLE public.display_branding
  DROP CONSTRAINT IF EXISTS display_branding_lower_third_style_check;
ALTER TABLE public.display_branding
  ADD CONSTRAINT display_branding_lower_third_style_check
  CHECK (lower_third_style IN ('broadcast','minimal','news','cinema','spotlight','sidebar','image'));