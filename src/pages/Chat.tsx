import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;

type ConversationDetails = {
  other_user_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_status: string | null;
  other_last_seen: string | null;
};

export default function Chat() {
  const { id: conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationDetails, setConversationDetails] =
    useState<ConversationDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !conversationId) {
      navigate("/auth");
      return;
    }

    loadConversationDetails();
    loadMessages();
    markAsRead();
    subscribeToMessages();
  }, [user, conversationId, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversationDetails = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase.rpc("get_conversation_details", {
        conv_id: conversationId,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setConversationDetails(data[0]);
      }
    } catch (error: any) {
      console.error("Load conversation details error:", error);
    }
  };

  const markAsRead = async () => {
    if (!conversationId || !user) return;

    try {
      await supabase.rpc("mark_conversation_as_read", {
        p_conversation_id: conversationId,
        p_user_id: user.id,
      });
    } catch (error: any) {
      console.error("Mark as read error:", error);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error: any) {
      console.error("Load messages error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الرسائل",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim(),
        message_type: "text",
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      console.error("Send message error:", error);
      toast({
        title: "فشل إرسال الرسالة",
        description: error.message || "حدث خطأ أثناء إرسال الرسالة",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessageId) return;

    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", selectedMessageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== selectedMessageId));
      
      toast({
        title: "تم حذف الرسالة",
        description: "تم حذف الرسالة بنجاح",
      });
    } catch (error: any) {
      console.error("Delete message error:", error);
      toast({
        title: "فشل حذف الرسالة",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedMessageId(null);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {conversationDetails && (
            <>
              <Avatar className="w-10 h-10 border-2 border-primary/20">
                <AvatarImage
                  src={conversationDetails.other_avatar_url || undefined}
                />
                <AvatarFallback className="bg-gradient-secondary text-white">
                  {conversationDetails.other_username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="font-semibold">
                  {conversationDetails.other_display_name ||
                    conversationDetails.other_username}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {conversationDetails.other_status || "غير متصل"}
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
              >
                <div className="relative">
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-gradient-primary text-white shadow-glow"
                        : "bg-card border border-border/30"
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? "text-white/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                  {isOwn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="bg-card border-t border-border/50 backdrop-blur-xl sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <Input
              placeholder="اكتب رسالة..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !sending && sendMessage()}
              className="flex-1 bg-input/50 border-border/50"
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={sending || !newMessage.trim()}
              className="bg-gradient-primary hover:opacity-90 shadow-glow"
              size="icon"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الرسالة بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
