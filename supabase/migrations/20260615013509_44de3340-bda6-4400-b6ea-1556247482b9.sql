
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS visit_interval_months integer,
  ADD COLUMN IF NOT EXISTS allowed_services text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS maintenance_message text;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_maintenance_date date,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_memberships_next_maint ON public.memberships(next_maintenance_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON public.memberships(end_date) WHERE status = 'active';
