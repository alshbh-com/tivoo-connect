-- Fix RLS policies for posts
DROP POLICY IF EXISTS "المستخدمون يمكنهم إنشاء بوستات" ON public.posts;
CREATE POLICY "المستخدمون يمكنهم إنشاء بوستات"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix RLS policies for stories  
DROP POLICY IF EXISTS "المستخدمون يمكنهم إضافة استوري" ON public.stories;
CREATE POLICY "المستخدمون يمكنهم إضافة استوري"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix get_user_conversations_with_details function
DROP FUNCTION IF EXISTS public.get_user_conversations_with_details(uuid);
CREATE OR REPLACE FUNCTION public.get_user_conversations_with_details(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  conversation_name text,
  is_group boolean,
  created_at timestamptz,
  last_message_content text,
  last_message_time timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_url text,
  other_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    c.name as conversation_name,
    c.is_group,
    c.created_at,
    last_msg.content as last_message_content,
    last_msg.created_at as last_message_time,
    last_msg.sender_id as last_message_sender_id,
    COALESCE(
      (SELECT COUNT(*)::bigint 
       FROM messages m2
       WHERE m2.conversation_id = c.id 
       AND m2.sender_id != p_user_id
       AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
       AND m2.deleted_for_all = false
      ), 0
    ) as unread_count,
    other_profile.id as other_user_id,
    other_profile.username as other_username,
    other_profile.display_name as other_display_name,
    other_profile.avatar_url as other_avatar_url,
    other_profile.status as other_status
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = p_user_id
  LEFT JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != p_user_id
  LEFT JOIN profiles other_profile ON other_profile.id = other_cp.user_id
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at, m.sender_id
    FROM messages m
    WHERE m.conversation_id = c.id
    AND m.deleted_for_all = false
    ORDER BY m.created_at DESC
    LIMIT 1
  ) last_msg ON true
  ORDER BY COALESCE(last_msg.created_at, c.created_at) DESC;
END;
$$;

-- Create admin user with encrypted password
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Insert admin profile
  INSERT INTO public.profiles (username, password_hash, display_name)
  VALUES ('alshbh', crypt('01278006248m', gen_salt('bf')), 'المسؤول')
  ON CONFLICT (username) DO NOTHING
  RETURNING id INTO admin_user_id;

  -- If user already exists, get their ID
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM public.profiles WHERE username = 'alshbh';
  END IF;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;