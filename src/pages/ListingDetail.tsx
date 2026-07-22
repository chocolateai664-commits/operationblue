import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Listing, CATEGORY_LABEL, formatUSD, formatPct } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lock, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BadgeRow } from "@/components/marketplace/BadgeRow";
import { TechStackTokens } from "@/components/marketplace/TechStackTokens";
import { MetricCallout } from "@/components/marketplace/MetricCallout";
import { NdaPanel } from "@/components/marketplace/NdaPanel";
import { MessageComposer } from "@/components/marketplace/MessageComposer";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface PrivateInfo {
  company_name: string | null;
  company_url: string | null;
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(false);
  const [privateInfo, setPrivateInfo] = useState<PrivateInfo | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from("listings")
      .select(
        "id, slug, seller_id, category, headline, description, tech_stack, asking_price, ttm_revenue, ttm_profit, arr, mrr, profit_margin, ltv, cac, assets_included, financing_available, reason_for_selling, growth_opportunities, badges, monthly_stats, status, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();
    setListing((data as unknown as Listing) ?? null);

    if (user) {
      const { data: nda } = await supabase
        .from("nda_signatures")
        .select("id")
        .eq("listing_id", id)
        .eq("buyer_id", user.id)
        .maybeSingle();
      const signed = Boolean(nda) || (data && (data as { seller_id: string }).seller_id === user.id);
      setNdaSigned(Boolean(signed));
      if (signed) {
        const { data: priv } = await supabase.rpc("get_listing_private", { _listing_id: id });
        const row = Array.isArray(priv) ? priv[0] : priv;
        setPrivateInfo(row ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-muted-foreground">Listing not found.</p>
        <Button asChild variant="link">
          <Link to="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    );
  }

  const netProfit = listing.ttm_profit;

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/marketplace">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-8">
        <div className="col-span-12 space-y-6 lg:col-span-8">
          {/* Hero */}
          <Card className="border-border/60 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {CATEGORY_LABEL[listing.category]}
                  </Badge>
                  <BadgeRow badges={listing.badges} />
                </div>
                <h1 className="text-2xl font-semibold leading-tight">{listing.headline}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {ndaSigned && privateInfo?.company_name ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">{privateInfo.company_name}</span>
                      {privateInfo.company_url && (
                        <a
                          href={privateInfo.company_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          {privateInfo.company_url.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Company identity locked — sign NDA to reveal
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Asking Price
                </div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {formatUSD(listing.asking_price)}
                </div>
                {listing.financing_available && (
                  <div className="mt-1 text-[11px] text-primary">Seller financing available</div>
                )}
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="terms">Acquisition Terms</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              <Card className="border-border/60 p-5">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  About the business
                </h3>
                <p className="text-sm leading-relaxed">{listing.description}</p>
              </Card>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-border/60 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Growth opportunities
                  </h3>
                  <p className="text-sm leading-relaxed">{listing.growth_opportunities}</p>
                </Card>
                <Card className="border-border/60 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Reason for selling
                  </h3>
                  <p className="text-sm leading-relaxed">{listing.reason_for_selling}</p>
                </Card>
              </div>
              <Card className="border-border/60 p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Tech stack
                </h3>
                <TechStackTokens items={listing.tech_stack} />
              </Card>
            </TabsContent>

            <TabsContent value="financials" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCallout label="ARR" value={formatUSD(listing.arr)} />
                <MetricCallout label="Net Profit (TTM)" value={formatUSD(netProfit)} />
                <MetricCallout label="LTV" value={formatUSD(listing.ltv)} />
                <MetricCallout label="CAC" value={formatUSD(listing.cac)} />
              </div>
              <Card className="border-border/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Revenue vs Expenses (12mo)
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Margin {formatPct(listing.profit_margin)}
                  </span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={listing.monthly_stats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="m"
                        tickFormatter={(v: string) => v.slice(5)}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatUSD(v)}
                      />
                      <Bar dataKey="rev" fill="hsl(var(--primary))" name="Revenue" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="exp"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        name="Expenses"
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="terms" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MetricCallout label="Asking Price" value={formatUSD(listing.asking_price)} />
                <MetricCallout
                  label="Financing"
                  value={listing.financing_available ? "Available" : "Cash only"}
                />
                <MetricCallout label="Multiple (Profit)" value={
                  listing.ttm_profit > 0
                    ? `${(listing.asking_price / listing.ttm_profit).toFixed(1)}x`
                    : "—"
                } />
              </div>
              <Card className="border-border/60 p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Assets included
                </h3>
                <ul className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {listing.assets_included.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      {a}
                    </li>
                  ))}
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="col-span-12 space-y-4 lg:col-span-4">
          {!user ? (
            <Card className="border-border/60 p-5 text-sm text-muted-foreground">
              Sign in to request confidential access.
            </Card>
          ) : ndaSigned && listing.seller_id ? (
            <MessageComposer
              listingId={listing.id}
              userId={user.id}
              sellerId={listing.seller_id}
              companyName={privateInfo?.company_name}
            />
          ) : ndaSigned ? (
            <Card className="border-border/60 p-5 text-sm text-muted-foreground">
              This is a demo listing without an assigned seller. Messaging is disabled.
            </Card>
          ) : (
            <NdaPanel listingId={listing.id} userId={user.id} onSigned={load} />
          )}

          <Card className="border-border/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Snapshot
            </h3>
            <dl className="space-y-2 text-sm">
              <Row k="TTM Revenue" v={formatUSD(listing.ttm_revenue)} />
              <Row k="TTM Profit" v={formatUSD(listing.ttm_profit)} />
              <Row k="Profit Margin" v={formatPct(listing.profit_margin)} />
              <Row k="MRR" v={formatUSD(listing.mrr)} />
              <Row k="ARR" v={formatUSD(listing.arr)} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}
