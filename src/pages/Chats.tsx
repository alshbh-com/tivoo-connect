import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Search, 
  Settings, 
  LogOut, 
  Users,
  Plus,
  Trash2,
  ImagePlus
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

type ConversationWithDetails = {
  conversation_id: string;
  conversation_name: string | null;
  is_group: boolean;
  created_at: string;
  last_message_content: string | null;
  last_message_time: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_status: string | null;
};

export default function Chats() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadConversations();
    subscribeToMessages();
  }, [user, navigate]);

  const loadConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .rpc("get_user_conversations_with_details", {
        p_user_id: user.id,
      });

    if (error) {
      console.error("Load conversations error:", error);
      return;
    }

    if (data) {
      setConversations(data);
    }
  };

  const subscribeToMessages = () => {
    if (!user) return;

    const channel = supabase
      .channel("all-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", selectedConvId);

      if (error) throw error;

      toast({
        title: "تم حذف المحادثة",
        description: "تم حذف المحادثة بنجاح",
      });

      loadConversations();
    } catch (error: any) {
      console.error("Delete conversation error:", error);
      toast({
        title: "فشل حذف المحادثة",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedConvId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? "الآن" : `${minutes} د`;
    }
    if (hours < 24) return `${hours} س`;
    const days = Math.floor(hours / 24);
    return `${days} ي`;
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.other_username?.toLowerCase().includes(searchLower) ||
      conv.other_display_name?.toLowerCase().includes(searchLower) ||
      conv.last_message_content?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">TIVOO CHAT</h1>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="hover:bg-primary/10"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="bg-card/50 backdrop-blur-sm border-b border-border/30 sticky top-[73px] z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن محادثة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input/50 border-border/50"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {filteredConversations.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">لا توجد محادثات بعد</h3>
            <p className="text-muted-foreground mb-6">
              ابدأ محادثة جديدة مع أصدقائك
            </p>
            <Button
              className="bg-gradient-primary hover:opacity-90 shadow-glow"
              onClick={() => navigate("/search")}
            >
              <Plus className="w-4 h-4 mr-2" />
              محادثة جديدة
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <Card
                key={conv.conversation_id}
                className="p-4 hover:bg-card/80 transition-all border-border/30 hover:border-primary/30 hover:shadow-glow relative group"
              >
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/chat/${conv.conversation_id}`)}
                >
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage src={conv.other_avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-secondary text-white">
                      {conv.other_username?.[0]?.toUpperCase() || "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {conv.other_display_name || conv.other_username || "محادثة"}
                      </h3>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1.5">
                          {conv.unread_count > 99 ? "99+" : conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message_content || "لا توجد رسائل بعد"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-xs text-muted-foreground">
                      {formatTime(conv.last_message_time || conv.created_at)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedConvId(conv.conversation_id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 left-6 flex flex-col gap-3">
        <button
          className="w-14 h-14 rounded-full bg-gradient-secondary shadow-elevated hover:scale-110 transition-transform flex items-center justify-center"
          onClick={() => navigate("/stories")}
          title="الاستوري"
        >
          <ImagePlus className="w-6 h-6 text-white" />
        </button>
        <button
          className="w-14 h-14 rounded-full bg-gradient-primary shadow-elevated hover:scale-110 transition-transform flex items-center justify-center"
          onClick={() => navigate("/search")}
          title="محادثة جديدة"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المحادثة وجميع الرسائل بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
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
