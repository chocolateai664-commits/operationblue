import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowUpRight } from "lucide-react";
import { CATEGORY_LABEL, Listing, formatUSD, formatPct } from "@/lib/marketplace";
import { BadgeRow } from "./BadgeRow";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Card className="group flex flex-col gap-4 border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {CATEGORY_LABEL[listing.category]}
            </Badge>
            <span className="text-xs text-muted-foreground">#{listing.slug.slice(0, 8)}</span>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">
            {listing.headline}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Asking</div>
          <div className="font-mono text-lg font-semibold tabular-nums">
            {formatUSD(listing.asking_price)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
        <Metric label="TTM Rev" value={formatUSD(listing.ttm_revenue)} />
        <Metric label="TTM Profit" value={formatUSD(listing.ttm_profit)} />
        <Metric label="Margin" value={formatPct(listing.profit_margin)} />
      </div>

      <BadgeRow badges={listing.badges} />

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Company hidden until NDA
        </div>
        <Button asChild size="sm" variant="secondary" className="gap-1">
          <Link to={`/marketplace/${listing.id}`}>
            Request Access
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
