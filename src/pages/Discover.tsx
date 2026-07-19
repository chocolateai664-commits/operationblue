import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

type Category = { id: string; label: string; emoji: string };

const CATEGORIES: Category[] = [
  { id: "manga", label: "Manga", emoji: "🎌" },
  { id: "comics", label: "Comics", emoji: "📚" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "movies", label: "Movies", emoji: "🎥" },
  { id: "tv", label: "TV Shows", emoji: "📺" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "anime", label: "Anime", emoji: "🎭" },
  { id: "popculture", label: "Pop Culture", emoji: "🌍" },
  { id: "technology", label: "Technology", emoji: "💻" },
  { id: "ai", label: "AI", emoji: "🚀" },
  { id: "sports", label: "Sports", emoji: "⚽" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

type FeedCard = {
  category: string;
  title: string;
  summary: string;
  prompt: string;
};

type SavedItem = {
  id: string;
  category: string | null;
  title: string;
  summary: string | null;
  prompt: string | null;
  source: string;
  created_at: string;
};

const STARTER_TEMPLATES: Record<string, string[]> = {
  manga: ["What are the must-read manga series right now?", "Recommend a manga based on my taste in {other}."],
  comics: ["What are the biggest ongoing comic storylines?", "Explain the current state of {topic} comics."],
  entertainment: ["What's trending in entertainment this week?"],
  gaming: ["Which games should I play this month?", "Compare the top games in {genre}."],
  movies: ["What movies are getting buzz right now?", "Recommend a movie like my favorites."],
  tv: ["Which TV shows are worth binging right now?"],
  music: ["What new music should I check out?", "Build me a playlist for {mood}."],
  anime: ["What anime series are trending this season?"],
  popculture: ["What's the biggest pop culture moment happening now?"],
  technology: ["What tech news should I know about this week?", "Explain the latest in {area}."],
  ai: ["What are the newest AI breakthroughs?", "How would AI change {industry}?"],
  sports: ["What's happening in sports this week?", "Break down the latest in {league}."],
};

function buildStarters(selected: string[]): { id: string; category: string; prompt: string }[] {
  const out: { id: string; category: string; prompt: string }[] = [];
  for (const id of selected) {
    const templates = STARTER_TEMPLATES[id];
    if (!templates) continue;
    const prompt = templates[0].replace(/\{[^}]+\}/g, CAT_MAP[id]?.label ?? id);
    out.push({ id: `starter-${id}`, category: id, prompt });
  }
  return out.slice(0, 6);
}

export default function Discover() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [feed, setFeed] = useState<FeedCard[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  // Load interests + saved items
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [interestsRes, savedRes] = await Promise.all([
        supabase.from("user_interests").select("category").eq("user_id", user.id),
        supabase
          .from("saved_items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (interestsRes.error) toast.error("Failed to load interests");
      else setSelected(new Set((interestsRes.data ?? []).map((r) => r.category)));
      if (savedRes.error) toast.error("Failed to load saved items");
      else setSavedItems((savedRes.data ?? []) as SavedItem[]);
      setLoadingInterests(false);
      setSavedLoading(false);
    })();
  }, [user?.id]);

  const selectedList = useMemo(() => Array.from(selected), [selected]);
  const starters = useMemo(() => buildStarters(selectedList), [selectedList]);

  const savedKeys = useMemo(
    () => new Set(savedItems.map((s) => `${s.title}::${s.category ?? ""}`)),
    [savedItems]
  );

  const loadFeed = useCallback(async () => {
    if (!user || selectedList.length === 0) {
      setFeed([]);
      return;
    }
    setFeedLoading(true);
    setFeedError(null);
    try {
      const { data, error } = await supabase.functions.invoke("discover-feed", {
        body: { interests: selectedList },
      });
      if (error) throw error;
      setFeed((data?.cards ?? []) as FeedCard[]);
    } catch (err: any) {
      console.error(err);
      setFeedError("Couldn't load your feed. Try again.");
    } finally {
      setFeedLoading(false);
    }
  }, [user, selectedList]);

  // Auto-load feed once we know what's selected
  useEffect(() => {
    if (!loadingInterests && selectedList.length > 0 && feed.length === 0 && !feedLoading) {
      loadFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInterests, selectedList.join(",")]);

  const toggle = async (id: string) => {
    if (!user || saving) return;
    setSaving(id);
    const isSelected = selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      isSelected ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_interests")
          .delete()
          .eq("user_id", user.id)
          .eq("category", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_interests")
          .insert({ user_id: user.id, category: id });
        if (error) throw error;
      }
      // Interests changed → invalidate feed so it refreshes on next load
      setFeed([]);
    } catch (err) {
      console.error(err);
      toast.error("Could not update interest");
      setSelected((prev) => {
        const next = new Set(prev);
        isSelected ? next.add(id) : next.delete(id);
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const openInChat = (prompt: string) => {
    sessionStorage.setItem("optineural:pending_prompt", prompt);
    navigate("/chat");
  };

  const saveCard = async (card: FeedCard) => {
    if (!user) return;
    const key = `${card.title}::${card.category}`;
    if (savedKeys.has(key)) {
      toast.info("Already saved");
      return;
    }
    // optimistic
    const temp: SavedItem = {
      id: `temp-${Date.now()}`,
      user_id: user.id as any,
      category: card.category,
      title: card.title,
      summary: card.summary,
      prompt: card.prompt,
      source: "feed",
      created_at: new Date().toISOString(),
    } as any;
    setSavedItems((prev) => [temp, ...prev]);
    const { data, error } = await supabase
      .from("saved_items")
      .insert({
        user_id: user.id,
        category: card.category,
        title: card.title,
        summary: card.summary,
        prompt: card.prompt,
        source: "feed",
      })
      .select()
      .single();
    if (error) {
      console.error(error);
      toast.error("Couldn't save");
      setSavedItems((prev) => prev.filter((s) => s.id !== temp.id));
      return;
    }
    setSavedItems((prev) => [data as SavedItem, ...prev.filter((s) => s.id !== temp.id)]);
    toast.success("Saved");
  };

  const removeSaved = async (id: string) => {
    const prev = savedItems;
    setSavedItems((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from("saved_items").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove");
      setSavedItems(prev);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
        <button
          onClick={() => navigate("/chat")}
          className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Discover</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-14">
        {/* Intro */}
        <section className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">
            Stay connected with the topics you love
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Pick your interests, get personalized chat starters, browse a live feed, and bookmark
            anything to revisit later.
          </p>
        </section>

        {/* Categories */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Popular Categories
            </h3>
            <span className="text-xs text-muted-foreground">
              {loadingInterests ? "Loading…" : `${selected.size} selected`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {CATEGORIES.map((c) => {
              const active = selected.has(c.id);
              const busy = saving === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  disabled={loadingInterests || busy}
                  aria-pressed={active}
                  className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-all min-h-11 disabled:opacity-60 ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <span className="text-lg leading-none">{c.emoji}</span>
                  <span className="flex-1 font-medium truncate">{c.label}</span>
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  ) : active ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Chat starters */}
        {selectedList.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Chat Starters
              </h3>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {starters.map((s) => {
                const cat = CAT_MAP[s.category];
                return (
                  <button
                    key={s.id}
                    onClick={() => openInChat(s.prompt)}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-secondary/40 transition-all"
                  >
                    <span className="text-xl leading-none mt-0.5">{cat?.emoji ?? "✨"}</span>
                    <span className="flex-1 text-sm leading-relaxed">{s.prompt}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Live feed */}
        {selectedList.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  For You
                </h3>
              </div>
              <button
                onClick={loadFeed}
                disabled={feedLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${feedLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {feedError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {feedError}
              </div>
            )}

            {feedLoading && feed.length === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 rounded-lg border border-border bg-card animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {feed.map((c, i) => {
                  const cat = CAT_MAP[c.category];
                  const saved = savedKeys.has(`${c.title}::${c.category}`);
                  return (
                    <article
                      key={`${c.title}-${i}`}
                      className="group rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{cat?.emoji ?? "✨"}</span>
                        <span className="uppercase tracking-wider">
                          {cat?.label ?? c.category}
                        </span>
                      </div>
                      <h4 className="font-semibold leading-snug">{c.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                        {c.summary}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => openInChat(c.prompt || `Tell me more about: ${c.title}`)}
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          Ask AI <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => saveCard(c)}
                          disabled={saved}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-60 disabled:hover:bg-transparent transition-colors"
                          aria-label={saved ? "Saved" : "Save for later"}
                        >
                          {saved ? (
                            <BookmarkCheck className="w-4 h-4 text-primary" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Saved items */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Saved for Later
            </h3>
            {!savedLoading && (
              <span className="text-xs text-muted-foreground">({savedItems.length})</span>
            )}
          </div>

          {savedLoading ? (
            <div className="h-20 rounded-lg border border-border bg-card animate-pulse" />
          ) : savedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Bookmark className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Bookmark cards from your feed to revisit them later.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {savedItems.map((s) => {
                const cat = s.category ? CAT_MAP[s.category] : undefined;
                return (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-lg leading-none mt-0.5">{cat?.emoji ?? "🔖"}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                        {cat?.label ?? s.category ?? "Saved"}
                      </div>
                      <h4 className="font-medium leading-snug truncate">{s.title}</h4>
                      {s.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {s.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.prompt && (
                        <button
                          onClick={() => openInChat(s.prompt!)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                          aria-label="Open in chat"
                          title="Open in chat"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeSaved(s.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary/50 transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Feed content is AI-generated based on your selected interests.
        </p>
      </main>
    </div>
  );
}
