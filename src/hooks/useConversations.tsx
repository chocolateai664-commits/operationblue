import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  summary: string | null;
  summary_message_count: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at, summary, summary_message_count")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(
    async (title: string = "New Chat") => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id, title, created_at, updated_at, summary, summary_message_count")
        .single();
      if (error || !data) return null;
      setConversations((prev) => [data, ...prev]);
      setActiveId(data.id);
      return data.id;
    },
    [user]
  );

  const updateTitle = useCallback(async (id: string, title: string) => {
    await supabase.from("conversations").update({ title }).eq("id", id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  const updateSummary = useCallback(
    async (id: string, summary: string, messageCount: number) => {
      await supabase
        .from("conversations")
        .update({ summary, summary_message_count: messageCount })
        .eq("id", id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, summary, summary_message_count: messageCount } : c))
      );
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await supabase.from("conversations").delete().eq("id", id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  return {
    conversations,
    activeId,
    setActiveId,
    loading,
    createConversation,
    updateTitle,
    updateSummary,
    deleteConversation,
    refresh: fetchConversations,
  };
}
