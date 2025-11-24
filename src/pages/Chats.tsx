import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { 
  MessageCircle, 
  Search, 
  Settings, 
  LogOut, 
  Users,
  Plus
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations">;
type Profile = Tables<"profiles">;

export default function Chats() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadConversations();
  }, [user, navigate]);

  const loadConversations = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        conversations (*)
      `)
      .eq("user_id", user.id);

    if (data) {
      const convs = data
        .map((item: any) => item.conversations)
        .filter(Boolean);
      setConversations(convs);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

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
        {conversations.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">لا توجد محادثات بعد</h3>
            <p className="text-muted-foreground mb-6">
              ابدأ محادثة جديدة مع أصدقائك
            </p>
            <Button className="bg-gradient-primary hover:opacity-90 shadow-glow">
              <Plus className="w-4 h-4 mr-2" />
              محادثة جديدة
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-4 cursor-pointer hover:bg-card/80 transition-all border-border/30 hover:border-primary/30 hover:shadow-glow"
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-gradient-secondary text-white">
                      {conv.name?.[0] || "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{conv.name || "محادثة"}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      اضغط لفتح المحادثة
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    الآن
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating action button */}
      <button
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-gradient-primary shadow-elevated hover:scale-110 transition-transform flex items-center justify-center"
        onClick={() => navigate("/new-chat")}
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
