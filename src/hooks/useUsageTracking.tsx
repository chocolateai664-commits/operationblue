import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const FREE_LIMIT = 5;

export function useUsageTracking() {
  const { user } = useAuth();
  const [totalRequests, setTotalRequests] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [monthlyTokens, setMonthlyTokens] = useState(0);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      if (data?.subscribed) {
        setIsPro(true);
      }
    } catch {
      // Subscription check failed, keep current state
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("usage_tracking")
      .select("total_requests, is_pro, monthly_cost, monthly_tokens")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setTotalRequests(data.total_requests);
      setIsPro(data.is_pro);
      setMonthlyCost(Number(data.monthly_cost) || 0);
      setMonthlyTokens(data.monthly_tokens || 0);
    } else {
      await supabase
        .from("usage_tracking")
        .insert({ user_id: user.id, total_requests: 0, is_pro: false });
      setTotalRequests(0);
      setIsPro(false);
      setMonthlyCost(0);
      setMonthlyTokens(0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Check subscription on load and periodically
  useEffect(() => {
    if (!user) return;
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const incrementUsage = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("increment_usage");
    if (!error && data !== null) {
      setTotalRequests(data);
      return data;
    }
    return totalRequests + 1;
  }, [user, totalRequests]);

  const canUseAI = isPro || totalRequests < FREE_LIMIT;
  const remainingFree = Math.max(0, FREE_LIMIT - totalRequests);
  const costLimit = isPro ? 7.0 : 0.5;

  return {
    totalRequests,
    isPro,
    loading,
    canUseAI,
    remainingFree,
    incrementUsage,
    FREE_LIMIT,
    checkSubscription,
    monthlyCost,
    monthlyTokens,
    costLimit,
  };
}
