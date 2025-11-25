import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "👎"];

interface Reaction {
  id: string;
  reaction: string;
  user_id: string;
}

interface MessageReactionsProps {
  messageId: string;
}

export function MessageReactions({ messageId }: MessageReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadReactions();
    subscribeToReactions();
  }, [messageId]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId);

    if (data) {
      setReactions(data);
    }
  };

  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const addReaction = async (reaction: string) => {
    if (!user) return;

    const existing = reactions.find((r) => r.user_id === user.id);

    if (existing) {
      if (existing.reaction === reaction) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existing.id);
      } else {
        await supabase
          .from("message_reactions")
          .update({ reaction })
          .eq("id", existing.id);
      }
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        reaction,
      });
    }

    setOpen(false);
  };

  const groupedReactions = reactions.reduce((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex items-center gap-1 mt-1">
      {Object.entries(groupedReactions).map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={() => addReaction(emoji)}
          className="text-xs bg-muted px-2 py-1 rounded-full hover:bg-muted/80 transition-colors"
        >
          {emoji} {count}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
