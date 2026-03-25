import { cn } from "@/lib/utils";
import { type AIModel, MODEL_META, ALL_MODELS } from "@/api/ai";

export type { AIModel };

interface ModelSelectorProps {
  selected: AIModel;
  onSelect: (model: AIModel) => void;
}

export function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {ALL_MODELS.map((id) => {
        const meta = MODEL_META[id];
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              selected === id
                ? "bg-secondary text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", meta.colorClass)} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
