-- Fix RLS policies for admin_settings
DROP POLICY IF EXISTS "الأدمن فقط يمكنه تعديل الإعدادات" ON admin_settings;
DROP POLICY IF EXISTS "الأدمن فقط يمكنه قراءة الإعدادات" ON admin_settings;

CREATE POLICY "Admin can manage settings"
ON admin_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Fix RLS policies for posts
DROP POLICY IF EXISTS "المستخدمون يمكنهم إنشاء بوستات" ON posts;

CREATE POLICY "Users can create posts"
ON posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix RLS policies for stories
DROP POLICY IF EXISTS "المستخدمون يمكنهم إضافة استوري" ON stories;

CREATE POLICY "Users can create stories"
ON stories
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Recreate get_admin_dashboard_stats with proper authorization
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stats JSONB;
  calling_user_id UUID;
  is_admin_user BOOLEAN;
BEGIN
  -- Get the calling user ID
  calling_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT has_role(calling_user_id, 'admin') INTO is_admin_user;
  
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Build stats
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = FALSE),
    'banned_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = TRUE),
    'total_messages', (SELECT COUNT(*) FROM messages WHERE is_deleted = FALSE),
    'active_conversations', (SELECT COUNT(DISTINCT conversation_id) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'),
    'pending_reports', (SELECT COUNT(*) FROM user_reports WHERE status = 'pending'),
    'today_registrations', (SELECT COUNT(*) FROM profiles WHERE created_at::date = CURRENT_DATE)
  ) INTO stats;

  RETURN stats;
END;
$function$;