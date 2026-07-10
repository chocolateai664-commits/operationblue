import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Order = {
  id: string;
  status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  paid: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-500 border-red-500/30",
  expired: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.expired;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function formatAmount(o: Order) {
  if (o.amount_total == null) return "—";
  const currency = (o.currency || "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(o.amount_total / 100);
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("orders load error", error);
      toast.error("Failed to load orders");
    } else {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel("orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    // Fallback polling in case realtime is unavailable
    const poll = setInterval(load, 10_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (authLoading) return null;

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-order-checkout");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      toast.error("Could not start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold">Orders</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">Realtime Stripe monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 rounded-md border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={startCheckout}
            disabled={checkoutLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New test order
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-border p-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">No orders yet.</p>
            <button
              onClick={startCheckout}
              disabled={checkoutLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create your first test order
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Order</th>
                  <th className="text-left px-4 py-2 font-medium">Customer</th>
                  <th className="text-left px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link to={`/orders/${o.id}`} className="text-primary hover:underline">
                        {o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{o.customer_email ?? "—"}</td>
                    <td className="px-4 py-2">{formatAmount(o)}</td>
                    <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(o.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
