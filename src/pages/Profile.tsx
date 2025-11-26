import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, MessageCircle } from "lucide-react";
import { useEffect } from "react";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

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
            <Avatar className="w-32 h-32 mx-auto mb-4 border-4 border-primary/20">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-primary text-white text-3xl">
                {user.display_name?.[0] || user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
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
