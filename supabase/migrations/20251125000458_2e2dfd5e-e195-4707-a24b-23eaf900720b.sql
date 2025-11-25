-- Add function to get conversations with details (last message, unread count, other user info)
CREATE OR REPLACE FUNCTION get_user_conversations_with_details(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  conversation_name TEXT,
  is_group BOOLEAN,
  created_at TIMESTAMPTZ,
  last_message_content TEXT,
  last_message_time TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT,
  other_user_id UUID,
  other_username TEXT,
  other_display_name TEXT,
  other_avatar_url TEXT,
  other_status TEXT
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
    m.content as last_message_content,
    m.created_at as last_message_time,
    m.sender_id as last_message_sender_id,
    (
      SELECT COUNT(*)
      FROM messages msg
      WHERE msg.conversation_id = c.id 
        AND msg.sender_id != p_user_id
        AND msg.created_at > COALESCE(
          (SELECT cp.last_read_at FROM conversation_participants cp 
           WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id),
          '1970-01-01'::timestamptz
        )
        AND msg.is_deleted = false
    ) as unread_count,
    p.id as other_user_id,
    p.username as other_username,
    p.display_name as other_display_name,
    p.avatar_url as other_avatar_url,
    p.status as other_status
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM messages
    WHERE conversation_id = c.id AND is_deleted = false
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != p_user_id
  LEFT JOIN profiles p ON p.id = cp2.user_id
  WHERE cp.user_id = p_user_id
  ORDER BY COALESCE(m.created_at, c.created_at) DESC;
END;
$$;

-- Add last_read_at column to conversation_participants
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT now();

-- Function to mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_conversation_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;