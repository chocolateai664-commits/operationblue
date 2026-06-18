import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const FREE_LIMIT_5H = 10;
const FREE_LIMIT_24H = 30;

interface RollingUsage {
  is_pro: boolean;
  is_admin: boolean;
  used_5h: number;
  limit_5h: number;
  used_24h: number;
  limit_24h: number;
  reset_at: string | null;
  authenticated?: boolean;
}

export function useUsageTracking() {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [used5h, setUsed5h] = useState(0);
  const [used24h, setUsed24h] = useState(0);
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      if (data?.subscribed) setIsPro(true);
    } catch {
      // ignore
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setIsPro(false);
      setUsed5h(0);
      setUsed24h(0);
      setResetAt(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("get_rolling_usage");
      if (!error && data) {
        const u = data as unknown as RollingUsage;
        setIsPro(!!u.is_pro);
        setUsed5h(u.used_5h ?? 0);
        setUsed24h(u.used_24h ?? 0);
        setResetAt(u.reset_at ? new Date(u.reset_at) : null);
      } else if (error) {
        console.error("get_rolling_usage error:", error);
      }
    } catch (e) {
      console.error("fetchUsage exception:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
    if (!user) return;
    const id = setInterval(fetchUsage, 30_000);
    return () => clearInterval(id);
  }, [fetchUsage, user]);

  useEffect(() => {
    if (!user) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const canUseAI = isPro || (used5h < FREE_LIMIT_5H && used24h < FREE_LIMIT_24H);
  const remainingFree = Math.max(0, FREE_LIMIT_5H - used5h);

  return {
    isPro,
    loading,
    canUseAI,
    used5h,
    used24h,
    remainingFree,
    resetAt,
    refresh: fetchUsage,
    checkSubscription,
    FREE_LIMIT: FREE_LIMIT_5H,
    FREE_LIMIT_24H,
    // legacy aliases used elsewhere
    totalRequests: used5h,
    incrementUsage: fetchUsage,
  };
}
