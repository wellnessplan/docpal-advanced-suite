-- Create staff_invitations table for pending invites (not yet signed-up auth users)
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'receptionist',
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff can view invitations"
  ON public.staff_invitations FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can insert invitations"
  ON public.staff_invitations FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can update invitations"
  ON public.staff_invitations FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic staff can delete invitations"
  ON public.staff_invitations FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE INDEX IF NOT EXISTS idx_staff_invitations_clinic ON public.staff_invitations(clinic_id);