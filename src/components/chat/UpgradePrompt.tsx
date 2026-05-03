import { Zap, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface UpgradePromptProps {
  usedCount: number;
  limit: number;
  resetAt?: Date | null;
  used24h?: number;
  limit24h?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function UpgradePrompt({ usedCount, limit, resetAt, used24h, limit24h }: UpgradePromptProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = resetAt ? resetAt.getTime() - now : 0;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 mx-auto max-w-md text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Zap className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-1">Limit reached. Try again after cooldown.</h3>
        <p className="text-sm text-muted-foreground">
          You've used {usedCount} of {limit} messages in the last 5 hours
          {typeof used24h === "number" && typeof limit24h === "number" && (
            <> · {used24h}/{limit24h} in 24h</>
          )}.
        </p>
        {resetAt && remainingMs > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-secondary/60 text-foreground">
            <Clock className="w-3.5 h-3.5" />
            Resets in {formatCountdown(remainingMs)}
          </div>
        )}
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        Upgrade to Pro
      </button>
    </div>
  );
}
