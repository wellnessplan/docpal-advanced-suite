-- Create a shared demo user for testing
DO $$
DECLARE
  demo_user_id uuid;
  demo_clinic_id uuid;
  existing_user_id uuid;
BEGIN
  -- Check if demo user already exists
  SELECT id INTO existing_user_id FROM auth.users WHERE email = 'demo@doctorsbuddy.app';
  
  IF existing_user_id IS NULL THEN
    -- Create the demo auth user with a known password
    demo_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      demo_user_id,
      'authenticated',
      'authenticated',
      'demo@doctorsbuddy.app',
      crypt('DemoPass2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Doctor"}'::jsonb,
      false, '', '', '', ''
    );
    
    -- Create identity record
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), demo_user_id,
      jsonb_build_object('sub', demo_user_id::text, 'email', 'demo@doctorsbuddy.app'),
      'email', demo_user_id::text, now(), now(), now()
    );
    
    -- Ensure profile exists (trigger should create it, but be safe)
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (demo_user_id, 'Demo Doctor')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create demo clinic and link
    INSERT INTO public.clinics (name, phone, email, address)
    VALUES ('Demo Dental Clinic', '+91 98765 43210', 'demo@doctorsbuddy.app', '123 Demo Street, Demo City')
    RETURNING id INTO demo_clinic_id;
    
    UPDATE public.profiles SET clinic_id = demo_clinic_id WHERE user_id = demo_user_id;
  END IF;
END $$;