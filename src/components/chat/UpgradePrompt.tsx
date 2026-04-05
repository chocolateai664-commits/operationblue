import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UpgradePromptProps {
  usedCount: number;
  limit: number;
}

export function UpgradePrompt({ usedCount, limit }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 mx-auto max-w-md text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Zap className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-1">Free tier limit reached</h3>
        <p className="text-sm text-muted-foreground">
          You've used {usedCount} of {limit} free AI requests. Upgrade to Pro for unlimited access to all models.
        </p>
      </div>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        Upgrade to Pro — $9.99/mo
      </button>
    </div>
  );
}
