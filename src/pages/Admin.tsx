import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Users, 
  MessageSquare, 
  AlertTriangle, 
  Activity,
  Search,
  Ban,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string | null;
  last_seen: string | null;
  is_banned?: boolean;
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "غير مصرح",
          description: "ليس لديك صلاحية الوصول لهذه الصفحة",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      loadStats();
    } catch (error: any) {
      console.error("Check admin error:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_dashboard_stats");

      if (error) throw error;
      setStats(data);
    } catch (error: any) {
      console.error("Load stats error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الإحصائيات",
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc("search_users", {
        search_term: searchQuery,
      });

      if (error) throw error;
      
      // Get ban status for search results
      const userIds = data?.map(u => u.id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, is_banned")
        .in("id", userIds);
      
      const resultsWithBanStatus = data?.map(user => ({
        ...user,
        is_banned: profiles?.find(p => p.id === user.id)?.is_banned || false
      })) || [];
      
      setSearchResults(resultsWithBanStatus);
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء البحث",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleBanUser = async (userId: string, ban: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: ban })
        .eq("id", userId);

      if (error) throw error;

      await supabase.rpc("log_admin_action", {
        _action: ban ? "ban_user" : "unban_user",
        _target_user_id: userId,
      });

      toast({
        title: ban ? "تم الحظر" : "تم إلغاء الحظر",
        description: ban ? "تم حظر المستخدم بنجاح" : "تم إلغاء حظر المستخدم بنجاح",
      });

      handleSearch();
      loadStats();
    } catch (error: any) {
      console.error("Ban user error:", error);
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">لوحة التحكم</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="reports">البلاغات</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                      <p className="text-2xl font-bold">{stats.total_users}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <Ban className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">المستخدمون المحظورون</p>
                      <p className="text-2xl font-bold">{stats.banned_users}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <MessageSquare className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الرسائل</p>
                      <p className="text-2xl font-bold">{stats.total_messages}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">البلاغات المعلقة</p>
                      <p className="text-2xl font-bold">{stats.pending_reports}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="ابحث عن مستخدم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                {searchResults.map((profile) => (
                  <Card key={profile.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {profile.display_name || profile.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{profile.username}
                        </p>
                        {profile.is_banned && (
                          <p className="text-xs text-red-500 mt-1">محظور</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/profile/${profile.id}`)}
                        >
                          عرض البروفايل
                        </Button>
                        {profile.is_banned ? (
                          <Button
                            size="sm"
                            onClick={() => handleBanUser(profile.id, false)}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            إلغاء الحظر
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleBanUser(profile.id, true)}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            حظر
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="p-6">
              <p className="text-muted-foreground">جاري العمل على هذه الميزة...</p>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6">
              <p className="text-muted-foreground">جاري العمل على هذه الميزة...</p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
