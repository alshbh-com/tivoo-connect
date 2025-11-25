import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Story = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export default function Stories() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storyContent, setStoryContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadStories();
  }, [user, navigate]);

  const loadStories = async () => {
    try {
      const { data, error } = await supabase
        .from("stories")
        .select(`
          *,
          profiles (username, display_name, avatar_url)
        `)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      setStories(data || []);
    } catch (error: any) {
      console.error("Load stories error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل الاستوريات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async () => {
    if (!user || (!storyContent.trim() && !mediaFile)) {
      toast({
        title: "خطأ",
        description: "يجب إضافة نص أو صورة",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      let mediaUrl = null;
      let mediaType = "text";

      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("chat-media")
          .getPublicUrl(filePath);

        mediaUrl = urlData.publicUrl;
        mediaType = mediaFile.type.startsWith("image/") ? "image" : "video";
      }

      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        content: storyContent.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
      });

      if (error) throw error;

      toast({
        title: "تم إضافة الاستوري",
        description: "تم إضافة الاستوري بنجاح",
      });

      setCreateDialogOpen(false);
      setStoryContent("");
      setMediaFile(null);
      loadStories();
    } catch (error: any) {
      console.error("Create story error:", error);
      toast({
        title: "فشل إضافة الاستوري",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} ساعة متبقية`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">الاستوريات</h1>
          <Button
            className="mr-auto bg-gradient-primary hover:opacity-90 shadow-glow"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            إضافة استوري
          </Button>
        </div>
      </header>

      {/* Stories Grid */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {stories.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/30">
            <h3 className="text-lg font-semibold mb-2">لا توجد استوريات</h3>
            <p className="text-muted-foreground mb-6">
              كن أول من يضيف استوري اليوم!
            </p>
            <Button
              className="bg-gradient-primary hover:opacity-90 shadow-glow"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              إضافة استوري
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stories.map((story) => (
              <Card
                key={story.id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-glow transition-all overflow-hidden aspect-[9/16]"
                onClick={() => setSelectedStory(story)}
              >
                <div className="relative h-full">
                  {story.media_url ? (
                    story.media_type === "image" ? (
                      <img
                        src={story.media_url}
                        alt="Story"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={story.media_url}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-primary flex items-center justify-center p-4">
                      <p className="text-white text-center break-words">
                        {story.content}
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="w-6 h-6 border border-white/30">
                        <AvatarImage src={story.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary">
                          {story.profiles.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-xs font-medium">
                        {story.profiles.display_name || story.profiles.username}
                      </span>
                    </div>
                    <p className="text-white/70 text-[10px]">
                      {formatTimeRemaining(story.expires_at)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Story Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة استوري جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="اكتب شيئاً..."
              value={storyContent}
              onChange={(e) => setStoryContent(e.target.value)}
              className="min-h-[100px]"
            />
            
            <div>
              <label className="block text-sm font-medium mb-2">
                أو أضف صورة/فيديو
              </label>
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
              {mediaFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {mediaFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setStoryContent("");
                  setMediaFile(null);
                }}
              >
                إلغاء
              </Button>
              <Button
                className="flex-1 bg-gradient-primary hover:opacity-90"
                onClick={handleCreateStory}
                disabled={uploading || (!storyContent.trim() && !mediaFile)}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    نشر
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Story Dialog */}
      <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
        <DialogContent className="sm:max-w-2xl p-0">
          {selectedStory && (
            <div className="relative bg-black aspect-[9/16]">
              {selectedStory.media_url ? (
                selectedStory.media_type === "image" ? (
                  <img
                    src={selectedStory.media_url}
                    alt="Story"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={selectedStory.media_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-primary flex items-center justify-center p-8">
                  <p className="text-white text-xl text-center">
                    {selectedStory.content}
                  </p>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={() => setSelectedStory(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-white/30">
                    <AvatarImage src={selectedStory.profiles.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary">
                      {selectedStory.profiles.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium">
                      {selectedStory.profiles.display_name || selectedStory.profiles.username}
                    </p>
                    <p className="text-white/70 text-sm">
                      {formatTimeRemaining(selectedStory.expires_at)}
                    </p>
                  </div>
                </div>
                {selectedStory.content && selectedStory.media_url && (
                  <p className="text-white mt-3">{selectedStory.content}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
