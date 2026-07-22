import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

interface Props {
  listingId: string;
  userId: string;
  sellerId: string;
  companyName?: string | null;
}

const DEFAULT_PROMPT = (co: string) =>
  `Hi, I'm interested in learning more about ${co}. Could you share more detail on your user acquisition channels and the tenure of your top customers?`;

export function MessageComposer({ listingId, userId, sellerId, companyName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState(DEFAULT_PROMPT(companyName || "your business"));
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("listing_messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as Msg[]) ?? []));
  }, [listingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { data, error } = await supabase
      .from("listing_messages")
      .insert({
        listing_id: listingId,
        sender_id: userId,
        recipient_id: sellerId,
        body: text,
      })
      .select("id, sender_id, recipient_id, body, created_at")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error(`Send failed: ${error?.message ?? "unknown"}`);
      return;
    }
    setMessages((m) => [...m, data as Msg]);
    setBody("");
  };

  return (
    <Card className="flex flex-col border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="text-sm font-semibold">Message the seller</div>
        <div className="text-xs text-muted-foreground">Encrypted 1:1 thread</div>
      </div>
      <div ref={scrollRef} className="max-h-64 min-h-[80px] space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground">No messages yet. Break the ice below.</div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 border-t border-border/60 p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          className="resize-none"
        />
        <Button onClick={send} disabled={sending} className="w-full gap-2">
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : "Send message"}
        </Button>
      </div>
    </Card>
  );
}
