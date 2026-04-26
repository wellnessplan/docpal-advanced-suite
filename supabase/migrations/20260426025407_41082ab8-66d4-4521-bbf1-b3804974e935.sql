
CREATE TABLE public.platform_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_label TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_audit_log_created_at ON public.platform_audit_log(created_at DESC);
CREATE INDEX idx_platform_audit_log_action ON public.platform_audit_log(action);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view platform audit log"
ON public.platform_audit_log
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert platform audit log"
ON public.platform_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() AND actor_user_id = auth.uid());
