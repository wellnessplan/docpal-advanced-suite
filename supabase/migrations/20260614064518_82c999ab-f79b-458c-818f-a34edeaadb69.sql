ALTER TABLE public.recall_reminders
  ADD COLUMN IF NOT EXISTS last_stage smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;