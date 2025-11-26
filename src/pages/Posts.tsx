import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Heart, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Post = Tables<"posts"> & {
  profiles: Profile;
  post_reactions: { id: string; user_id: string; reaction: string }[];
};

export default function Posts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadPosts();
  }, [user, navigate]);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles:user_id (*), post_reactions (*)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data as Post[]);
    } catch (error: any) {
      console.error("Load posts error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البوستات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("posts").insert({
        user_id: user!.id,
        content: newPost.trim(),
      });
      if (error) throw error;
      setNewPost("");
      setShowCreateDialog(false);
      loadPosts();
      toast({
        title: "تم نشر البوست",
        description: "تم نشر البوست بنجاح",
      });
    } catch (error: any) {
      console.error("Add post error:", error);
      toast({
        title: "فشل نشر البوست",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (postId: string) => {
    try {
      const existingReaction = posts
        .find((p) => p.id === postId)
        ?.post_reactions.find((r) => r.user_id === user?.id);
      if (existingReaction) {
        await supabase.from("post_reactions").delete().eq("id", existingReaction.id);
      } else {
        await supabase
          .from("post_reactions")
          .insert({ post_id: postId, user_id: user!.id, reaction: "❤️" });
      }
      loadPosts();
    } catch (error: any) {
      console.error("Reaction error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">البوستات</h1>
          <Button
            className="mr-auto bg-gradient-primary hover:opacity-90 shadow-glow"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            بوست جديد
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {showCreateDialog && (
          <Card className="p-4 border-primary/30 shadow-glow">
            <Textarea
              placeholder="اكتب بوست جديد..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="mb-3 min-h-[120px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddPost}
                disabled={posting || !newPost.trim()}
                className="bg-gradient-primary hover:opacity-90 flex-1"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "نشر"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewPost("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </Card>
        )}

        {posts.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <h3 className="text-lg font-semibold mb-2">لا توجد بوستات بعد</h3>
            <p className="text-muted-foreground mb-6">كن أول من ينشر بوست اليوم!</p>
            <Button
              className="bg-gradient-primary hover:opacity-90 shadow-glow"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              بوست جديد
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="p-4 hover:border-primary/30 transition-colors">
                <div
                  className="flex items-start gap-3 mb-3 cursor-pointer"
                  onClick={() => navigate(`/profile/${post.profiles.id}`)}
                >
                  <Avatar className="w-10 h-10 border-2 border-primary/20">
                    <AvatarImage src={post.profiles.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-secondary text-white">
                      {post.profiles.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">
                      {post.profiles.display_name || post.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{post.profiles.username} •{" "}
                      {new Date(post.created_at!).toLocaleString("ar-EG")}
                    </p>
                  </div>
                </div>
                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed">
                  {post.content}
                </p>
                <button
                  onClick={() => handleReaction(post.id)}
                  className={`flex items-center gap-2 hover:text-red-500 transition-colors ${
                    post.post_reactions.some((r) => r.user_id === user?.id)
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      post.post_reactions.some((r) => r.user_id === user?.id)
                        ? "fill-current"
                        : ""
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {post.post_reactions.length}
                  </span>
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
