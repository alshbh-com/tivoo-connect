import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, MessageCircle, Shield, Upload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    checkAdmin();
  }, [user, navigate]);

  const checkAdmin = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(data || false);
    } catch (error) {
      console.error("Check admin error:", error);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "تم تحديث الصورة",
        description: "تم تحديث صورة البروفايل بنجاح",
      });

      window.location.reload();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء رفع الصورة",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-xl font-bold">الإعدادات</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Card className="p-8 bg-card/80 backdrop-blur-xl border-border/50 shadow-elevated">
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <Avatar className="w-32 h-32 mx-auto mb-4 border-4 border-primary/20">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-primary text-white text-3xl">
                  {user.display_name?.[0] || user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-3 right-1/2 translate-x-1/2 bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-full cursor-pointer shadow-lg transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>
            
            <h1 className="text-2xl font-bold mb-1">
              {user.display_name || user.username}
            </h1>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <User className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">اسم المستخدم</p>
                <p className="font-medium">@{user.username}</p>
              </div>
            </div>

            {user.bio && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">النبذة التعريفية</p>
                  <p className="font-medium">{user.bio}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
              <div>
                <p className="text-sm text-muted-foreground">الحالة</p>
                <p className="font-medium text-success">{user.status || "متصل"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate(`/profile/${user.id}`)}
              variant="outline"
              className="w-full border-border/50 hover:border-primary/50 transition-colors"
            >
              عرض البروفايل
            </Button>

            <Button
              onClick={() => navigate("/posts")}
              variant="outline"
              className="w-full border-border/50 hover:border-primary/50 transition-colors"
            >
              البوستات
            </Button>

            {isAdmin && (
              <Button
                onClick={() => navigate("/admin")}
                variant="outline"
                className="w-full border-border/50 hover:border-primary/50 transition-colors"
              >
                <Shield className="w-4 h-4 mr-2" />
                لوحة الأدمن
              </Button>
            )}
            
            <a
              href={`https://wa.me/201204486263?text=${encodeURIComponent(
                "مرحباً، أحتاج مساعدة في TIVOO CHAT"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                variant="outline"
                className="w-full border-border/50 hover:border-accent/50 hover:text-accent transition-colors"
              >
                تواصل مع الدعم
              </Button>
            </a>
            
            <Button
              onClick={() => {
                logout();
                navigate("/auth");
              }}
              variant="destructive"
              className="w-full"
            >
              تسجيل الخروج
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
