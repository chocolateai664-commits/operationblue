import { Badge } from "@/components/ui/badge";
import { BADGE_LABEL } from "@/lib/marketplace";
import { CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";

const ICONS: Record<string, JSX.Element> = {
  vetted: <ShieldCheck className="h-3 w-3" />,
  profitable: <TrendingUp className="h-3 w-3" />,
  stripe_verified: <CheckCircle2 className="h-3 w-3" />,
};

export function BadgeRow({ badges }: { badges: string[] }) {
  if (!badges?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge
          key={b}
          variant="secondary"
          className="gap-1 border-border/60 bg-secondary/60 text-[11px] font-medium"
        >
          {ICONS[b]}
          {BADGE_LABEL[b] ?? b}
        </Badge>
      ))}
    </div>
  );
}
