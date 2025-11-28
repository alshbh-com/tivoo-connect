-- Create auth users for existing profiles that don't have auth accounts
DO $$
DECLARE
  profile_record RECORD;
  new_auth_user_id UUID;
  auth_email TEXT;
BEGIN
  -- Loop through profiles that need auth users
  FOR profile_record IN 
    SELECT id, username, password_hash, display_name
    FROM public.profiles
    WHERE id NOT IN (SELECT id FROM auth.users)
  LOOP
    -- Create email for this user
    auth_email := profile_record.username || '@tivoo.internal';
    
    -- Insert into auth.users using the profile's existing UUID
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      profile_record.id,
      '00000000-0000-0000-0000-000000000000',
      auth_email,
      crypt(profile_record.password_hash, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', profile_record.username, 'display_name', profile_record.display_name),
      'authenticated',
      'authenticated'
    );
    
    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      profile_record.id,
      profile_record.id::text,
      jsonb_build_object('sub', profile_record.id::text, 'email', auth_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created auth user for profile: %', profile_record.username;
  END LOOP;
END $$;