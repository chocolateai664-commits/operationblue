import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, Check, Loader2, RefreshCw, Sparkles, Sun } from "lucide-react";

type Category = {
  id: string;
  label: string;
  emoji: string;
};

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

const FEATURES = [
  {
    icon: Sparkles,
    title: "Personalized Experience",
    body:
      "Your Discover page is tailored to your preferences. As you interact with content, Operation Blue learns your interests and highlights the topics that matter most to you.",
  },
  {
    icon: Sun,
    title: "Fresh Daily Content",
    body:
      "New stories, trending discussions, and featured recommendations are refreshed regularly to keep your experience engaging and up to date.",
  },
  {
    icon: Bookmark,
    title: "Save for Later",
    body:
      "Bookmark articles and topics you enjoy so you can easily return to them anytime.",
  },
  {
    icon: RefreshCw,
    title: "Smart Recommendations",
    body:
      "Receive curated suggestions based on your interests and activity, helping you discover new content without unnecessary clutter.",
  },
];

export default function Discover() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("user_interests")
        .select("category")
        .eq("user_id", user.id);
      if (error) {
        console.error(error);
        toast.error("Failed to load your interests");
      } else {
        setSelected(new Set((data ?? []).map((r) => r.category)));
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const toggle = async (id: string) => {
    if (!user || saving) return;
    setSaving(id);
    const isSelected = selected.has(id);
    // optimistic update
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
    } catch (err) {
      console.error(err);
      toast.error("Could not update interest");
      // revert
      setSelected((prev) => {
        const next = new Set(prev);
        isSelected ? next.add(id) : next.delete(id);
        return next;
      });
    } finally {
      setSaving(null);
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

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <section className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">
            Stay connected with the topics you love
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Select your interests, and Operation Blue will personalize your experience with
            relevant updates and recommendations.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Popular Categories
            </h3>
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${selected.size} selected`}
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
                  disabled={loading || busy}
                  aria-pressed={active}
                  className={`relative group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-all min-h-11 disabled:opacity-60 ${
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

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="font-semibold">{title}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Content and recommendations may vary based on your selected preferences and
          available sources.
        </p>
      </main>
    </div>
  );
}
