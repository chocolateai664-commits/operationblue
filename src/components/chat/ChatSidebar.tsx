import { useState } from "react";
import { Plus, MessageSquare, Trash2, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/hooks/useConversations";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isPro?: boolean;
}

export function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, isPro }: ChatSidebarProps) {
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="w-64 h-full flex flex-col bg-sidebar-background border-r border-sidebar-border">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              activeId === conv.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {isPro && (
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleManage}
            disabled={portalLoading}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
            Manage Subscription
          </button>
        </div>
      )}
    </div>
  );
}
