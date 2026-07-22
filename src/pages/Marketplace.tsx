import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Listing } from "@/lib/marketplace";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { DEFAULT_FILTERS, Filters, FilterSidebar } from "@/components/marketplace/FilterSidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Store } from "lucide-react";
import { toast } from "sonner";

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, slug, seller_id, category, headline, description, tech_stack, asking_price, ttm_revenue, ttm_profit, arr, mrr, profit_margin, ltv, cac, assets_included, financing_available, reason_for_selling, growth_opportunities, badges, monthly_stats, status, created_at, updated_at"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setListings((data as unknown as Listing[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const tech = filters.techQuery.trim().toLowerCase();
    return listings.filter((l) => {
      if (q && !l.headline.toLowerCase().includes(q) && !l.description.toLowerCase().includes(q))
        return false;
      if (filters.categories.length && !filters.categories.includes(l.category)) return false;
      if (l.asking_price > filters.maxPrice) return false;
      if (l.arr < filters.minArr) return false;
      if (l.ttm_revenue < filters.minTtm) return false;
      if (l.profit_margin * 100 < filters.minMargin) return false;
      if (tech && !l.tech_stack.some((t) => t.toLowerCase().includes(tech))) return false;
      return true;
    });
  }, [listings, filters]);

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Marketplace</h1>
              <p className="text-xs text-muted-foreground">
                Curated micro-startups for sale — anonymized until NDA
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="gap-1">
            <Link to="/sell">
              <Plus className="h-4 w-4" />
              List your startup
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-8">
        <div className="col-span-12 lg:col-span-3">
          <FilterSidebar filters={filters} onChange={setFilters} />
        </div>
        <div className="col-span-12 space-y-4 lg:col-span-9">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {loading ? "Loading listings..." : `${filtered.length} results`}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
              No listings match your filters. Try relaxing them.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
