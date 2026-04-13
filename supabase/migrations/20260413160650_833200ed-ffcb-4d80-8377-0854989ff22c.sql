CREATE OR REPLACE FUNCTION public.create_clinic_for_user(
  p_name text,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_clinic_id uuid;
BEGIN
  INSERT INTO public.clinics (name, phone, address, email)
  VALUES (p_name, p_phone, p_address, p_email)
  RETURNING id INTO new_clinic_id;

  UPDATE public.profiles
  SET clinic_id = new_clinic_id
  WHERE user_id = auth.uid();

  RETURN new_clinic_id;
END;
$$;