import { cn } from "@/lib/utils";

export type ChatMode = "single" | "compare";

interface ModeToggleProps {
  mode: ChatMode;
  onToggle: (mode: ChatMode) => void;
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="flex items-center bg-secondary rounded-lg p-0.5">
      {(["single", "compare"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onToggle(m)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize",
            mode === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "compare" ? "⚡ Compare" : "Single"}
        </button>
      ))}
    </div>
  );
}
