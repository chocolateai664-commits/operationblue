import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { MarkdownContent } from "./MarkdownContent";
import { MODEL_META, type AIModel } from "@/api/ai";
import { cn } from "@/lib/utils";

interface CompareResult {
  model: string;
  content: string;
  isStreaming?: boolean;
}

interface CompareViewProps {
  results: CompareResult[];
}

export function CompareView({ results }: CompareViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
      {results.map((r, i) => {
        const meta = r.model in MODEL_META ? MODEL_META[r.model as AIModel] : null;
        return (
          <motion.div
            key={r.model}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 hover:border-border-strong transition-colors"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/60">
              <span className={cn("w-1.5 h-1.5 rounded-full", meta?.colorClass ?? "bg-muted")} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {meta?.label ?? r.model}
              </span>
              {r.isStreaming && <Sparkles className="w-3 h-3 text-primary animate-pulse ml-auto" />}
            </div>
            <div className="text-[13px] leading-relaxed text-foreground">
              <MarkdownContent content={r.content || "_thinking..._"} />
              {r.isStreaming && (
                <span className="inline-block ml-1 align-middle w-1.5 h-3.5 bg-primary/70 rounded-sm animate-pulse" />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
