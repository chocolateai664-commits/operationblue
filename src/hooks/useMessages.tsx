import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
}

export interface SaveMessageResult {
  ok: boolean;
  data: DBMessage | null;
  error: string | null;
}

export function useMessages() {
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, model, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("loadMessages error:", error);
      setLoadError(error.message);
      toast.error(`Failed to load messages: ${error.message}`);
      setMessages([]);
    } else {
      setMessages((data as DBMessage[]) ?? []);
    }
    setLoading(false);
  }, []);

  const saveMessage = useCallback(
    async (
      conversationId: string,
      role: "user" | "assistant",
      content: string,
      model?: string
    ): Promise<SaveMessageResult> => {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role,
          content,
          model: model ?? null,
        })
        .select("id, role, content, model, created_at")
        .single();

      if (error || !data) {
        const msg = error?.message ?? "Unknown error saving message";
        console.error("saveMessage error:", error);
        toast.error(`Message not saved: ${msg}`);
        return { ok: false, data: null, error: msg };
      }

      setMessages((prev) => [...prev, data as DBMessage]);
      return { ok: true, data: data as DBMessage, error: null };
    },
    []
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, loading, loadError, loadMessages, saveMessage, clearMessages };
}
