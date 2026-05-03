ALTER TABLE public.lower_third_presets
  ADD COLUMN IF NOT EXISTS ticker_messages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opacity numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS video_ids uuid[] NOT NULL DEFAULT '{}';