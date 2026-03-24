import { cn } from "@/lib/utils";

export type AIModel = "gemini" | "gpt-5" | "flash";

interface ModelSelectorProps {
  selected: AIModel;
  onSelect: (model: AIModel) => void;
}

const models: { id: AIModel; label: string; color: string }[] = [
  { id: "flash", label: "Flash", color: "bg-model-green" },
  { id: "gemini", label: "Gemini Pro", color: "bg-model-blue" },
  { id: "gpt-5", label: "GPT-5", color: "bg-model-purple" },
];

export function ModelSelector({ selected, onSelect }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
            selected === m.id
              ? "bg-secondary text-foreground ring-1 ring-primary/40"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", m.color)} />
          {m.label}
        </button>
      ))}
    </div>
  );
}
