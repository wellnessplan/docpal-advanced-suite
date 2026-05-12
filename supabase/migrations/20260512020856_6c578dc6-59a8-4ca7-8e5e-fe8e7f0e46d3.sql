
-- 1) Audit log: tighten view policy to admins/super-admins only
DROP POLICY IF EXISTS "Clinic staff can view audit log" ON public.audit_log;
CREATE POLICY "Admins can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  clinic_id = public.get_user_clinic_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin()
  )
);

-- 2) Idempotency for delivery callbacks: dedupe by (provider_message_id, status)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_delivery_status_dedupe
  ON public.whatsapp_delivery_status (provider_message_id, status);

-- 3) Patient-facing status lookup (anon-callable, scoped by clinic + phone)
CREATE OR REPLACE FUNCTION public.lookup_registration_status(
  p_clinic_id uuid,
  p_phone text
) RETURNS TABLE (
  template_name text,
  status text,
  delivery_status text,
  sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT template_name, status, delivery_status, sent_at
  FROM public.whatsapp_logs
  WHERE clinic_id = p_clinic_id
    AND phone = p_phone
    AND template_name = 'registration_confirmation'
  ORDER BY sent_at DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_registration_status(uuid, text) TO anon, authenticated;
