import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const FREE_LIMIT = 5;

export function useUsageTracking() {
  const { user } = useAuth();
  const [totalRequests, setTotalRequests] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("usage_tracking")
      .select("total_requests, is_pro")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setTotalRequests(data.total_requests);
      setIsPro(data.is_pro);
    } else {
      // Create initial record
      await supabase
        .from("usage_tracking")
        .insert({ user_id: user.id, total_requests: 0, is_pro: false });
      setTotalRequests(0);
      setIsPro(false);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const incrementUsage = useCallback(async () => {
    if (!user) return;
    const newCount = totalRequests + 1;
    await supabase
      .from("usage_tracking")
      .update({ total_requests: newCount })
      .eq("user_id", user.id);
    setTotalRequests(newCount);
    return newCount;
  }, [user, totalRequests]);

  const canUseAI = isPro || totalRequests < FREE_LIMIT;
  const remainingFree = Math.max(0, FREE_LIMIT - totalRequests);

  return { totalRequests, isPro, loading, canUseAI, remainingFree, incrementUsage, FREE_LIMIT };
}
