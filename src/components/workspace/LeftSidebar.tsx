import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, MessageSquare, Trash2, Crown, Loader2, Search, Sparkles, ChevronsLeft, Settings2, LogOut, CreditCard, Store, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/hooks/useConversations";
import { MODEL_META, ALL_MODELS, type AIModel } from "@/api/ai";

interface LeftSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isPro?: boolean;
  selectedModel: AIModel;
  onSelectModel: (m: AIModel) => void;
  onCollapse?: () => void;
  onSignOut: () => void;
}

function groupConversations(list: Conversation[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const groups: Record<string, Conversation[]> = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const c of list) {
    const age = now - new Date(c.updated_at).getTime();
    if (age < day) groups.Today.push(c);
    else if (age < 2 * day) groups.Yesterday.push(c);
    else if (age < 7 * day) groups["Previous 7 days"].push(c);
    else groups.Older.push(c);
  }
  return groups;
}

export function LeftSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isPro,
  selectedModel,
  onSelectModel,
  onCollapse,
  onSignOut,
}: LeftSidebarProps) {
  const [query, setQuery] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data } = await supabase.functions.invoke("customer-portal");
      if (data?.url) window.open(data.url, "_blank");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <aside className="h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand row */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-sidebar-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight truncate">OptiNeural</span>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* New chat */}
      <div className="px-2 pt-2">
        <button
          onClick={onNew}
          className="group w-full flex items-center gap-2 px-3 h-9 rounded-lg bg-gradient-to-b from-primary to-primary/90 text-primary-foreground hover:brightness-110 transition-all text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Navigation */}
      <div className="px-2 pt-2 space-y-0.5">
        <button
          onClick={() => navigate("/marketplace")}
          className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <Store className="w-3.5 h-3.5" />
          Marketplace
        </button>
        <button
          onClick={() => navigate("/discover")}
          className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <Compass className="w-3.5 h-3.5" />
          Discover
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full h-8 bg-sidebar-accent/60 border border-sidebar-border rounded-lg pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-3 mt-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {query ? "No matches" : "No conversations yet"}
          </p>
        )}
        {(["Today", "Yesterday", "Previous 7 days", "Older"] as const).map((label) =>
          groups[label].length === 0 ? null : (
            <div key={label}>
              <div className="px-2 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                {label}
              </div>
              <div className="space-y-0.5">
                {groups[label].map((conv) => (
                  <motion.div
                    key={conv.id}
                    layout
                    className={cn(
                      "group flex items-center gap-2 px-2.5 h-8 rounded-md cursor-pointer text-[13px] transition-colors",
                      activeId === conv.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                    onClick={() => onSelect(conv.id)}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0 opacity-60" />
                    <span className="truncate flex-1 leading-none">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      aria-label="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 p-1 -mr-1 rounded hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Models */}
      <div className="px-2 pt-2 border-t border-sidebar-border/60">
        <div className="px-2 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
          Models
        </div>
        <div className="space-y-0.5 pb-2">
          {ALL_MODELS.map((m) => {
            const meta = MODEL_META[m];
            const active = selectedModel === m;
            return (
              <button
                key={m}
                onClick={() => onSelectModel(m)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", meta.colorClass)} />
                <span className="flex-1 text-left leading-none">{meta.label}</span>
                {active && <span className="text-[9px] uppercase tracking-wider text-primary/80">active</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-2 border-t border-sidebar-border/60 space-y-0.5">
        <button
          onClick={() => navigate("/pricing")}
          className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <Crown className="w-3.5 h-3.5" />
          {isPro ? "Pro" : "Upgrade to Pro"}
        </button>
        {isPro && (
          <button
            onClick={handleManage}
            disabled={portalLoading}
            className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors disabled:opacity-50"
          >
            {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            Manage subscription
          </button>
        )}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
