
-- Add invite token to staff_invitations for shareable signup links
ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS invite_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '14 days');

-- Backfill missing tokens
UPDATE public.staff_invitations SET invite_token = replace(gen_random_uuid()::text, '-', '') WHERE invite_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations(invite_token);

-- Allow anonymous lookup of invitation by token (so signup page can validate)
CREATE POLICY "Anyone can view invitation by token"
  ON public.staff_invitations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop old restrictive view policy and re-add for authenticated clinic staff (now redundant since above is permissive)
-- We keep the existing one; they don't conflict because both are permissive.

-- RPC to accept an invitation: links the currently signed-in user's profile to the clinic + role
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.staff_invitations%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.staff_invitations
  WHERE invite_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, expired, or already used';
  END IF;

  -- Update user's profile to join the clinic with the invited role
  UPDATE public.profiles
  SET clinic_id = v_invite.clinic_id,
      role = v_invite.role::app_role
  WHERE user_id = v_user_id;

  -- Mark invitation accepted
  UPDATE public.staff_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', v_invite.clinic_id,
    'role', v_invite.role
  );
END;
$$;
