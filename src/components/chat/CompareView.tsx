import { Sparkles } from "lucide-react";

interface CompareResult {
  model: string;
  content: string;
  isStreaming?: boolean;
}

interface CompareViewProps {
  results: CompareResult[];
}

const modelColors: Record<string, string> = {
  ollama: "text-model-orange border-model-orange/30",
  flash: "text-model-green border-model-green/30",
  gemini: "text-model-blue border-model-blue/30",
  "gpt-5": "text-model-purple border-model-purple/30",
};

export function CompareView({ results }: CompareViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 py-4">
      {results.map((r) => (
        <div
          key={r.model}
          className={`rounded-xl border bg-secondary/40 p-4 ${
            modelColors[r.model] || "border-border"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {r.model}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {r.content}
            {r.isStreaming && (
              <span className="inline-flex gap-0.5 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot [animation-delay:0.4s]" />
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
