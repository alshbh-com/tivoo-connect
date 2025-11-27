-- إصلاح RLS policies للأدمن ليتمكن من تحديث profiles
DROP POLICY IF EXISTS "المستخدمون يمكنهم تحديث بروفايلات" ON public.profiles;

CREATE POLICY "المستخدمون يمكنهم تحديث بروفايلاتهم أو الأدمن يمكنه تحديث أي بروفايل"
ON public.profiles
FOR UPDATE
USING (
  id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin'::user_role)
);

-- إنشاء جدول الإبلاغات عن المستخدمين
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reporter_id, reported_user_id)
);

-- RLS policies لجدول user_reports
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يمكنهم إضافة إبلاغ"
ON public.user_reports
FOR INSERT
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "الأدمن يمكنه قراءة جميع الإبلاغات"
ON public.user_reports
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "الأدمن يمكنه تحديث الإبلاغات"
ON public.user_reports
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

-- إضافة عمود blocked_ips للحظر النهائي
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- تحديث RPC function للإحصائيات لإصلاح مشكلة Unauthorized
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats JSONB;
  calling_user_id UUID;
BEGIN
  -- الحصول على user_id من auth.uid()
  calling_user_id := auth.uid();
  
  -- التحقق من أن المستخدم أدمن
  IF NOT public.has_role(calling_user_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = FALSE),
    'banned_users', (SELECT COUNT(*) FROM profiles WHERE is_banned = TRUE),
    'total_messages', (SELECT COUNT(*) FROM messages WHERE is_deleted = FALSE),
    'active_conversations', (SELECT COUNT(DISTINCT conversation_id) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'),
    'pending_reports', (SELECT COUNT(*) FROM user_reports WHERE status = 'pending'),
    'today_registrations', (SELECT COUNT(*) FROM profiles WHERE created_at::date = CURRENT_DATE),
    'lockdown_mode', COALESCE((SELECT setting_value::boolean FROM admin_settings WHERE setting_key = 'lockdown_mode'), FALSE)
  ) INTO stats;

  RETURN stats;
END;
$$;

-- إنشاء جدول لحفظ الأجهزة المحظورة
CREATE TABLE IF NOT EXISTS public.device_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.device_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "الأدمن فقط يمكنه إدارة حظر الأجهزة"
ON public.device_bans
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));