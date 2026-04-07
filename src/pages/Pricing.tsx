import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Loader2, ArrowLeft, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUsageTracking } from "@/hooks/useUsageTracking";

const freeTierFeatures = [
  "5 AI requests total",
  "Ollama models only",
  "Basic chat history",
  "Single model mode",
];

const proTierFeatures = [
  "Unlimited AI requests",
  "All models (Ollama + OpenAI + Gemini)",
  "Full chat history & sync",
  "Compare mode across models",
  "Priority support",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { isPro } = useUsageTracking();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckoutLoading(false);
    }
  };

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
    <div className="min-h-screen-safe bg-background flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold">Pricing</h1>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Free Tier */}
          <div className={`rounded-2xl border p-6 flex flex-col ${!isPro ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
            {!isPro && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Current Plan</span>
            )}
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <p className="text-2xl font-bold mb-1">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-sm text-muted-foreground mb-6">Get started with AI chat</p>
            <ul className="space-y-3 flex-1">
              {freeTierFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Tier */}
          <div className={`rounded-2xl border p-6 flex flex-col ${isPro ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
            {isPro && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Your Plan
              </span>
            )}
            <h2 className="text-xl font-bold mb-1">Pro</h2>
            <p className="text-2xl font-bold mb-1">$9.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-sm text-muted-foreground mb-6">Unlimited access to all models</p>
            <ul className="space-y-3 flex-1 mb-6">
              {proTierFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isPro ? (
              <button
                onClick={handleManage}
                disabled={portalLoading}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
