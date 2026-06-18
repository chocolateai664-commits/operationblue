import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  summary: string | null;
  summary_message_count: number;
}

export type ConversationsErrorKind = "permission" | "network" | "unknown" | null;

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ConversationsErrorKind>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      setError(null);
      setErrorKind(null);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    const { data, error: dbError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at, summary, summary_message_count")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (dbError) {
      console.error("fetchConversations error:", dbError);
      const code = (dbError as { code?: string }).code ?? "";
      const msg = dbError.message ?? "Failed to load conversations";
      let kind: ConversationsErrorKind = "unknown";
      if (code === "42501" || /permission|rls|denied/i.test(msg)) kind = "permission";
      else if (/network|fetch|timeout/i.test(msg)) kind = "network";
      setError(msg);
      setErrorKind(kind);
      toast.error(
        kind === "permission"
          ? "You don't have access to these conversations."
          : kind === "network"
          ? "Network issue loading conversations. Retrying soon…"
          : `Failed to load conversations: ${msg}`
      );
      setConversations([]);
    } else {
      setConversations(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(
    async (title: string = "New Chat") => {
      if (!user) return null;
      const { data, error: dbError } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id, title, created_at, updated_at, summary, summary_message_count")
        .single();
      if (dbError || !data) {
        console.error("createConversation error:", dbError);
        toast.error(`Could not create chat: ${dbError?.message ?? "unknown error"}`);
        return null;
      }
      setConversations((prev) => [data, ...prev]);
      setActiveId(data.id);
      return data.id;
    },
    [user]
  );

  const updateTitle = useCallback(async (id: string, title: string) => {
    const { error: dbError } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (dbError) {
      console.error("updateTitle error:", dbError);
      toast.error("Failed to rename conversation");
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const updateSummary = useCallback(
    async (id: string, summary: string, messageCount: number) => {
      const { error: dbError } = await supabase
        .from("conversations")
        .update({ summary, summary_message_count: messageCount })
        .eq("id", id);
      if (dbError) {
        console.error("updateSummary error:", dbError);
        return;
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, summary, summary_message_count: messageCount } : c))
      );
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase.from("conversations").delete().eq("id", id);
      if (dbError) {
        console.error("deleteConversation error:", dbError);
        toast.error("Failed to delete conversation");
        return;
      }
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
    error,
    errorKind,
    createConversation,
    updateTitle,
    updateSummary,
    deleteConversation,
    refresh: fetchConversations,
  };
}
