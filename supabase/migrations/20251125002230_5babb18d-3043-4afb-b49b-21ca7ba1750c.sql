-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS get_conversation_details(UUID);

-- إضافة عمود is_online
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- إضافة جدول مشاهدات الاستوري
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- إضافة أعمدة لحذف الرسائل
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_all BOOLEAN DEFAULT false;

-- جدول الرياكشنز على الرسائل
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- تفعيل RLS
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- سياسات story_views
CREATE POLICY "الجميع يمكنهم إضافة مشاهدة" ON story_views FOR INSERT WITH CHECK (true);
CREATE POLICY "صاحب الاستوري يمكنه رؤية المشاهدات" ON story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid())
);

-- سياسات message_reactions
CREATE POLICY "الجميع يمكنهم إضافة رياكشن" ON message_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "المشاركون يمكنهم رؤية الرياكشنز" ON message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id
  )
);
CREATE POLICY "المستخدمون يمكنهم حذف رياكشنهم" ON message_reactions FOR DELETE USING (user_id = auth.uid());

-- إعادة إنشاء الدالة
CREATE FUNCTION get_conversation_details(conv_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_username TEXT,
  other_display_name TEXT,
  other_avatar_url TEXT,
  other_status TEXT,
  other_last_seen TIMESTAMPTZ,
  other_is_online BOOLEAN
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.status,
    p.last_seen,
    COALESCE(p.is_online, false)
  FROM conversations c
  JOIN conversation_participants cp ON cp.conversation_id = c.id
  JOIN profiles p ON p.id = cp.user_id
  WHERE c.id = conv_id AND cp.user_id != auth.uid()
  LIMIT 1;
$$;

-- دالة عدد المشاهدات
CREATE OR REPLACE FUNCTION get_story_views_count(p_story_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM story_views WHERE story_id = p_story_id;
$$;

-- تحديث سياسات stories
DROP POLICY IF EXISTS "الجميع يمكنهم رؤية الحالات غير الم" ON stories;
DROP POLICY IF EXISTS "المستخدمون يمكنهم إضافة حالات" ON stories;

CREATE POLICY "الجميع يمكنهم رؤية الاستوريهات النشطة" ON stories FOR SELECT USING (expires_at > now());
CREATE POLICY "المستخدمون يمكنهم إضافة استوري" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "المستخدمون يمكنهم تحديث استوريهم" ON stories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "المستخدمون يمكنهم حذف استوريهم" ON stories FOR DELETE USING (user_id = auth.uid());