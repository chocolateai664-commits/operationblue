import { useState, useMemo } from "react";
import { Plus, Trash2, Search, ChevronsLeft, Settings, LogOut, Crown, Store, Compass, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/hooks/useConversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeftSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isPro?: boolean;
  userName: string;
  onCollapse?: () => void;
  onSignOut: () => void;
}

export function LeftSidebar({ conversations, activeId, onSelect, onNew, onDelete, isPro, userName, onCollapse, onSignOut }: LeftSidebarProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const initial = (userName.trim()[0] ?? "U").toUpperCase();
  const rowCls =
    "w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors";

  return (
    <aside className="h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center justify-between px-3 h-12">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-primary text-lg leading-none">✦</span>
          <span className="text-sm font-semibold tracking-[0.12em] uppercase truncate">OptiNeural</span>
        </div>
        {onCollapse && (
          <button onClick={onCollapse} aria-label="Collapse sidebar" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-2 space-y-0.5">
        <button onClick={onNew} className={cn(rowCls, "text-sidebar-foreground font-medium")}>
          <Plus className="w-4 h-4" />
          New conversation
        </button>
        <button onClick={() => setSearchOpen((v) => !v)} className={rowCls} aria-expanded={searchOpen}>
          <Search className="w-4 h-4" />
          Search
        </button>
        {searchOpen && (
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full h-9 bg-sidebar-accent/60 border border-sidebar-border rounded-md px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40"
          />
        )}
      </div>

      {/* Recent */}
      <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">Recent</div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground px-2.5 py-3">{query ? "No matches" : "No conversations yet"}</p>
        )}
        {filtered.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center rounded-md text-[13px] transition-colors",
              activeId === conv.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <button onClick={() => onSelect(conv.id)} className="flex-1 min-w-0 flex items-center gap-2 px-2.5 h-9 text-left">
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span className="truncate">{conv.title}</span>
            </button>
            <button
              onClick={() => onDelete(conv.id)}
              aria-label="Delete conversation"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 mr-0.5 rounded hover:text-destructive transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border/60 space-y-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(rowCls, "outline-none")}>
            <Settings className="w-4 h-4" />
            Settings
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem onSelect={() => navigate("/discover")}><Compass className="w-4 h-4 mr-2" />Discover</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/marketplace")}><Store className="w-4 h-4 mr-2" />Marketplace</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/pricing")}><Crown className="w-4 h-4 mr-2" />{isPro ? "Plan: Pro" : "Upgrade to Pro"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2.5 px-2.5 h-10">
          <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">{initial}</span>
          <span className="text-[13px] font-medium truncate">{userName}</span>
          {isPro && <span className="ml-auto text-[10px] uppercase tracking-wider text-primary">Pro</span>}
        </div>
      </div>
    </aside>
  );
}
