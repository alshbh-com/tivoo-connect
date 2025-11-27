-- Fix admin user setup - ensure alshbh exists and has admin role with correct auth user
DO $$
DECLARE
  admin_user_id UUID;
  admin_auth_id UUID;
BEGIN
  -- Check if admin profile exists
  SELECT id INTO admin_user_id FROM profiles WHERE username = 'alshbh';
  
  IF admin_user_id IS NULL THEN
    -- Create admin profile with new UUID
    INSERT INTO profiles (username, password_hash, display_name, is_banned)
    VALUES ('alshbh', encode(digest('01278006248m', 'sha256'), 'hex'), 'مطور البرنامج', FALSE)
    RETURNING id INTO admin_user_id;
  END IF;
  
  -- Ensure admin role exists
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Also ensure user role exists
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;