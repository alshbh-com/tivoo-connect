-- Create user_role enum if not exists
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table for role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "الجميع يمكنهم قراءة الأدوار" ON public.user_roles;
  DROP POLICY IF EXISTS "السماح بإضافة أدوار للمستخدمين الجدد" ON public.user_roles;
  DROP POLICY IF EXISTS "السماح بإنشاء دور مستخدم عادي" ON public.user_roles;
END $$;

-- Allow everyone to read roles
CREATE POLICY "الجميع يمكنهم قراءة الأدوار"
ON public.user_roles FOR SELECT
USING (true);

-- Allow new users to get user role
CREATE POLICY "السماح بإضافة أدوار للمستخدمين الجدد"
ON public.user_roles FOR INSERT
WITH CHECK (role = 'user');

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate posts policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "الجميع يمكنهم قراءة البوستات" ON public.posts;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم إنشاء بوستات" ON public.posts;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم تحديث بوستاتهم" ON public.posts;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم حذف بوستاتهم" ON public.posts;
END $$;

-- Posts policies
CREATE POLICY "الجميع يمكنهم قراءة البوستات"
ON public.posts FOR SELECT
USING (true);

CREATE POLICY "المستخدمون يمكنهم إنشاء بوستات"
ON public.posts FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "المستخدمون يمكنهم تحديث بوستاتهم"
ON public.posts FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "المستخدمون يمكنهم حذف بوستاتهم"
ON public.posts FOR DELETE
USING (user_id = auth.uid());

-- Create post_reactions table
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on post_reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate post_reactions policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "الجميع يمكنهم قراءة رياكشنز البوستات" ON public.post_reactions;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم إضافة رياكشن" ON public.post_reactions;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم حذف رياكشنهم" ON public.post_reactions;
END $$;

-- Post reactions policies
CREATE POLICY "الجميع يمكنهم قراءة رياكشنز البوستات"
ON public.post_reactions FOR SELECT
USING (true);

CREATE POLICY "المستخدمون يمكنهم إضافة رياكشن"
ON public.post_reactions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "المستخدمون يمكنهم حذف رياكشنهم"
ON public.post_reactions FOR DELETE
USING (user_id = auth.uid());

-- Update friendships policies if needed
DO $$ BEGIN
  DROP POLICY IF EXISTS "المستخدمون يمكنهم رؤية صداقاتهم" ON public.friendships;
  DROP POLICY IF EXISTS "المستخدمون يمكنهم إضافة أصدقاء" ON public.friendships;
END $$;

CREATE POLICY "المستخدمون يمكنهم رؤية صداقاتهم"
ON public.friendships FOR SELECT
USING (true);

CREATE POLICY "المستخدمون يمكنهم إضافة أصدقاء"
ON public.friendships FOR INSERT
WITH CHECK (true);

-- Create admin functions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_user_id UUID DEFAULT NULL,
  _details JSONB DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (admin_id, action, target_user_id, details, ip_address)
  VALUES (auth.uid(), _action, _target_user_id, _details, _ip_address)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create function to get admin dashboard stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats JSONB;
BEGIN
  -- التحقق من أن المستخدم أدمن
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = FALSE),
    'banned_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = TRUE),
    'total_messages', (SELECT COUNT(*) FROM messages WHERE is_deleted = FALSE),
    'active_conversations', (SELECT COUNT(DISTINCT conversation_id) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'),
    'pending_reports', (SELECT COUNT(*) FROM reported_messages WHERE status = 'pending'),
    'today_registrations', (SELECT COUNT(*) FROM profiles WHERE created_at::date = CURRENT_DATE),
    'lockdown_mode', COALESCE((SELECT setting_value::boolean FROM admin_settings WHERE setting_key = 'lockdown_mode'), FALSE)
  ) INTO stats;

  RETURN stats;
END;
$$;