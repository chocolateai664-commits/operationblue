import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
}

export function useMessages() {
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, model, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as DBMessage[]) ?? []);
    setLoading(false);
  }, []);

  const saveMessage = useCallback(
    async (conversationId: string, role: "user" | "assistant", content: string, model?: string) => {
      const { data } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role,
          content,
          model: model ?? null,
        })
        .select("id, role, content, model, created_at")
        .single();
      if (data) {
        setMessages((prev) => [...prev, data as DBMessage]);
      }
      return data;
    },
    []
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, loading, loadMessages, saveMessage, clearMessages };
}
