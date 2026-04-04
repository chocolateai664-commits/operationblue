import { Zap } from "lucide-react";

interface UpgradePromptProps {
  usedCount: number;
  limit: number;
}

export function UpgradePrompt({ usedCount, limit }: UpgradePromptProps) {
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
        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        onClick={() => {
          // TODO: Connect to Stripe checkout
          alert("Stripe checkout coming soon!");
        }}
      >
        Upgrade to Pro — Unlimited AI
      </button>
    </div>
  );
}
