import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, User, Copy, Check, RotateCcw } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { useState } from "react";
import { MODEL_META, type AIModel } from "@/api/ai";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  model?: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export function ChatMessage({ role, content, model, isStreaming, onRegenerate }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const modelMeta = model && model in MODEL_META ? MODEL_META[model as AIModel] : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("group flex gap-4 py-6", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5",
          isUser
            ? "bg-secondary text-foreground ring-1 ring-border"
            : "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow"
        )}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
      </div>

      <div className={cn("flex-1 min-w-0 max-w-[760px]", isUser && "flex flex-col items-end")}>
        {modelMeta && !isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", modelMeta.colorClass)} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {modelMeta.label}
            </span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl text-[14px] leading-[1.7] w-fit max-w-full",
            isUser
              ? "bg-primary/90 text-primary-foreground px-4 py-2.5 shadow-sm"
              : "text-foreground"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <MarkdownContent content={content} />
          )}
          {isStreaming && (
            <span className="inline-block ml-1 align-middle w-1.5 h-4 bg-primary/80 rounded-sm animate-pulse" />
          )}
        </div>

        {!isUser && !isStreaming && content.length > 0 && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                aria-label="Regenerate"
              >
                <RotateCcw className="w-3 h-3" />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
