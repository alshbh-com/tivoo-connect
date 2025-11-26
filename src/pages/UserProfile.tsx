import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MessageCircle, UserPlus, Heart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Post = Tables<"posts"> & {
  profiles: Profile;
  post_reactions: { id: string; user_id: string; reaction: string }[];
};

export default function UserProfile() {
  const { id: profileId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [friendship, setFriendship] = useState<any>(null);

  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadProfile();
    loadPosts();
    if (!isOwnProfile) {
      loadFriendship();
    }
  }, [user, profileId]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Load profile error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles:user_id (*), post_reactions (*)`)
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data as Post[]);
    } catch (error: any) {
      console.error("Load posts error:", error);
    }
  };

  const loadFriendship = async () => {
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_id.eq.${user?.id},friend_id.eq.${profileId}),and(user_id.eq.${profileId},friend_id.eq.${user?.id})`)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      setFriendship(data);
    } catch (error: any) {
      console.error("Load friendship error:", error);
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
      loadPosts();
    } catch (error: any) {
      console.error("Add post error:", error);
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (postId: string) => {
    try {
      const existingReaction = posts.find((p) => p.id === postId)?.post_reactions.find((r) => r.user_id === user?.id);
      if (existingReaction) {
        await supabase.from("post_reactions").delete().eq("id", existingReaction.id);
      } else {
        await supabase.from("post_reactions").insert({ post_id: postId, user_id: user!.id, reaction: "❤️" });
      }
      loadPosts();
    } catch (error: any) {
      console.error("Reaction error:", error);
    }
  };

  const handleStartChat = async () => {
    try {
      const { data } = await supabase.rpc("create_conversation", { participant_ids: [user!.id, profileId!] });
      if (data) navigate(`/chat/${data}`);
    } catch (error: any) {
      console.error("Start chat error:", error);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p>المستخدم غير موجود</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-primary/10"><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">البروفايل</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-secondary text-white text-2xl">{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{profile.display_name || profile.username}</h2>
              <p className="text-muted-foreground">@{profile.username}</p>
              {profile.bio && <p className="mt-2">{profile.bio}</p>}
            </div>
          </div>
          {!isOwnProfile && (
            <div className="flex gap-3 mt-4">
              <Button onClick={handleStartChat} className="flex-1 bg-gradient-primary hover:opacity-90"><MessageCircle className="w-4 h-4 mr-2" />محادثة</Button>
              {!friendship && <Button onClick={async () => { await supabase.from("friendships").insert({ user_id: user!.id, friend_id: profileId!, status: "pending" }); loadFriendship(); }} variant="outline" className="flex-1"><UserPlus className="w-4 h-4 mr-2" />إضافة صديق</Button>}
            </div>
          )}
        </Card>
        {isOwnProfile && (
          <Card className="p-4">
            <Textarea placeholder="اكتب بوست جديد..." value={newPost} onChange={(e) => setNewPost(e.target.value)} className="mb-3 min-h-[100px]" />
            <Button onClick={handleAddPost} disabled={posting || !newPost.trim()} className="bg-gradient-primary hover:opacity-90">{posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "نشر"}</Button>
          </Card>
        )}
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.profiles.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-secondary text-white">{post.profiles.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{post.profiles.display_name || post.profiles.username}</p>
                  <p className="text-xs text-muted-foreground">{new Date(post.created_at!).toLocaleString("ar-EG")}</p>
                </div>
              </div>
              <p className="mb-3 whitespace-pre-wrap">{post.content}</p>
              <button onClick={() => handleReaction(post.id)} className={`flex items-center gap-1 hover:text-red-500 transition-colors ${post.post_reactions.some((r) => r.user_id === user?.id) ? "text-red-500" : ""}`}>
                <Heart className="w-5 h-5" /><span>{post.post_reactions.length}</span>
              </button>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
