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
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [lockdownMode, setLockdownMode] = useState(false);

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
      loadReports();
      loadSettings();
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

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from("user_reports")
        .select(`
          *,
          reporter:reporter_id(username, display_name),
          reported:reported_user_id(username, display_name, is_banned)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      console.error("Load reports error:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("setting_key", "lockdown_mode")
        .maybeSingle();

      setLockdownMode(data?.setting_value === "true");
    } catch (error: any) {
      console.error("Load settings error:", error);
    }
  };

  const handleReviewReport = async (reportId: string, status: string, adminNotes?: string) => {
    try {
      const { error } = await supabase
        .from("user_reports")
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes || null,
        })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "تم تحديث البلاغ",
        description: "تم تحديث حالة البلاغ بنجاح",
      });

      loadReports();
    } catch (error: any) {
      console.error("Review report error:", error);
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleLockdown = async () => {
    try {
      const newValue = !lockdownMode;
      const { error } = await supabase
        .from("admin_settings")
        .upsert({
          setting_key: "lockdown_mode",
          setting_value: String(newValue),
          updated_by: user?.id,
        });

      if (error) throw error;

      setLockdownMode(newValue);
      toast({
        title: newValue ? "تم تفعيل وضع الطوارئ" : "تم إلغاء وضع الطوارئ",
        description: newValue
          ? "تم إيقاف الرسائل الجديدة مؤقتاً"
          : "تم السماح بإرسال الرسائل",
      });
    } catch (error: any) {
      console.error("Toggle lockdown error:", error);
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
            <div className="space-y-4">
              {loadingReports ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : reports.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">لا توجد بلاغات</p>
                </Card>
              ) : (
                reports.map((report) => (
                  <Card key={report.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">
                            {report.reporter?.display_name || report.reporter?.username}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            أبلغ عن @{report.reported?.username}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            report.status === "pending"
                              ? "bg-orange-500/10 text-orange-500"
                              : report.status === "resolved"
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {report.status === "pending"
                            ? "معلق"
                            : report.status === "resolved"
                            ? "تم الحل"
                            : "مرفوض"}
                        </span>
                      </div>
                      <div className="bg-muted/30 rounded p-3">
                        <p className="text-sm font-medium mb-1">السبب:</p>
                        <p className="text-sm">{report.reason}</p>
                        {report.details && (
                          <>
                            <p className="text-sm font-medium mt-2 mb-1">التفاصيل:</p>
                            <p className="text-sm">{report.details}</p>
                          </>
                        )}
                      </div>
                      {report.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/profile/${report.reported_user_id}`)}
                          >
                            عرض البروفايل
                          </Button>
                          {!report.reported?.is_banned && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                await handleBanUser(report.reported_user_id, true);
                                await handleReviewReport(report.id, "resolved", "تم حظر المستخدم");
                              }}
                            >
                              حظر المستخدم
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleReviewReport(report.id, "dismissed")}
                          >
                            رفض البلاغ
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">إعدادات عامة</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">وضع الطوارئ</p>
                      <p className="text-sm text-muted-foreground">
                        إيقاف إرسال الرسائل الجديدة مؤقتاً
                      </p>
                    </div>
                    <Button
                      variant={lockdownMode ? "destructive" : "outline"}
                      onClick={handleToggleLockdown}
                    >
                      {lockdownMode ? "إلغاء الطوارئ" : "تفعيل الطوارئ"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
