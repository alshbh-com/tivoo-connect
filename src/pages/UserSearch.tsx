import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string | null;
  last_seen: string | null;
};

export default function UserSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "أدخل نص للبحث",
        description: "يرجى إدخال اسم مستخدم للبحث",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("search_users", {
        search_term: searchQuery.trim(),
      });

      if (error) throw error;

      setResults(data || []);
      setSearched(true);
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "خطأ في البحث",
        description: error.message || "حدث خطأ أثناء البحث",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (otherUserId: string) => {
    if (!user) return;

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase.rpc("create_conversation", {
        participant_ids: [user.id, otherUserId],
      });

      if (existingConv) {
        navigate(`/chat/${existingConv}`);
      }
    } catch (error: any) {
      console.error("Start chat error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء بدء المحادثة",
        variant: "destructive",
      });
    }
  };

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
          <h1 className="text-xl font-bold">بحث عن مستخدمين</h1>
        </div>
      </header>

      {/* Search */}
      <div className="bg-card/50 backdrop-blur-sm border-b border-border/30 sticky top-[73px] z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث باسم المستخدم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-input/50 border-border/50"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-primary hover:opacity-90 shadow-glow"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {!searched ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ابحث عن أصدقاء</h3>
            <p className="text-muted-foreground">
              استخدم شريط البحث أعلاه للعثور على مستخدمين
            </p>
          </Card>
        ) : results.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
            <p className="text-muted-foreground mb-4">
              لم يتم العثور على مستخدمين بهذا الاسم. حاول البحث بكلمات مختلفة أو
              تحقق من الإملاء.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSearched(false);
                setResults([]);
              }}
            >
              بحث جديد
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {results.map((result) => (
              <Card
                key={result.id}
                className="p-4 hover:bg-card/80 transition-all border-border/30 hover:border-primary/30 hover:shadow-glow"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage src={result.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-secondary text-white">
                      {result.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {result.display_name || result.username}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      @{result.username}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startChat(result.id)}
                    className="bg-gradient-primary hover:opacity-90 shadow-glow"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    محادثة
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
