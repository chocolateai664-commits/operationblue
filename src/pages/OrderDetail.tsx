import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type Order = {
  id: string;
  status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  created_at: string;
  updated_at: string;
};

function StatusVisual({ status }: { status: string }) {
  if (status === "paid")
    return (
      <div className="flex items-center gap-2 text-emerald-500">
        <CheckCircle2 className="w-5 h-5" /> Payment Successful
      </div>
    );
  if (status === "failed")
    return (
      <div className="flex items-center gap-2 text-red-500">
        <XCircle className="w-5 h-5" /> Payment Failed
      </div>
    );
  if (status === "expired")
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="w-5 h-5" /> Checkout Expired
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-yellow-500">
      <Clock className="w-5 h-5 animate-pulse" /> Payment Processing
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const canceled = params.get("canceled") === "1";

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) console.error(error);
    setOrder((data as Order) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !id) return;
    load();
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => setOrder(payload.new as Order),
      )
      .subscribe();
    const poll = setInterval(load, 10_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  if (authLoading || loading) return null;

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link
          to="/orders"
          className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to orders"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold">Order</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {!order ? (
          <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            Order not found.
          </div>
        ) : (
          <>
            {canceled && order.status === "pending" && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-sm px-3 py-2">
                Checkout was canceled. You can start a new one from the Orders page.
              </div>
            )}
            <div className="rounded-lg border border-border p-6 space-y-4">
              <StatusVisual status={order.status} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Order ID</div>
                  <div className="font-mono text-xs break-all">{order.id}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Amount</div>
                  <div>
                    {order.amount_total != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: (order.currency || "usd").toUpperCase(),
                        }).format(order.amount_total / 100)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Customer</div>
                  <div>{order.customer_email ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Payment Intent</div>
                  <div className="font-mono text-xs break-all">{order.stripe_payment_intent_id ?? "—"}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Updated {new Date(order.updated_at).toLocaleString()} · live via Realtime
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
