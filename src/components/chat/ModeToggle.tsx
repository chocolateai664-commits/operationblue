import { cn } from "@/lib/utils";
import { GitCompare, MessageSquare } from "lucide-react";

export type ChatMode = "single" | "compare";

interface ModeToggleProps {
  mode: ChatMode;
  onToggle: (mode: ChatMode) => void;
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="flex items-center bg-secondary/60 border border-border rounded-lg p-0.5">
      {(["single", "compare"] as const).map((m) => {
        const Icon = m === "single" ? MessageSquare : GitCompare;
        return (
          <button
            key={m}
            onClick={() => onToggle(m)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 capitalize",
              mode === m
                ? "bg-card text-foreground shadow-sm ring-1 ring-border-strong"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {m}
          </button>
        );
      })}
    </div>
  );
}
