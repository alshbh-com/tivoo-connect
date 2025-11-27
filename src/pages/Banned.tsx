import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ban, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Banned() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user?.is_banned) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-card/80 backdrop-blur-xl border-border/50 shadow-elevated">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <Ban className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-destructive">تم حظر حسابك</h1>
          <p className="text-muted-foreground mb-4">
            عذراً، تم حظر حسابك من استخدام TIVOO CHAT
          </p>
          {user.blocked_reason && (
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground mb-1">سبب الحظر:</p>
              <p className="font-medium">{user.blocked_reason}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <a
            href={`https://wa.me/201204486263?text=${encodeURIComponent(
              `مرحباً، تم حظر حسابي (${user.username}) وأريد مراجعة الحظر`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button className="w-full bg-success hover:bg-success/90">
              <MessageCircle className="w-4 h-4 mr-2" />
              تواصل مع الدعم على واتساب
            </Button>
          </a>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              logout();
              navigate("/auth");
            }}
          >
            تسجيل الخروج
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          للاستفسار عن الحظر أو إلغائه، يرجى التواصل مع الدعم
        </p>
      </Card>
    </div>
  );
}
