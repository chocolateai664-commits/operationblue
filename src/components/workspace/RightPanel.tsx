import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsRight, FileCode2, FileText, Braces, Copy, Check, Download, Crown, Zap, Clock, Activity, Cpu, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODEL_META, type AIModel } from "@/api/ai";
import { OllamaSettings, type OllamaConfig } from "@/components/chat/OllamaSettings";
import type { DBMessage } from "@/hooks/useMessages";

interface RightPanelProps {
  model: AIModel;
  isPro: boolean;
  used5h: number;
  used24h: number;
  limit5h: number;
  limit24h: number;
  resetAt: Date | null;
  messages: DBMessage[];
  ollamaConfig: OllamaConfig;
  onOllamaChange: (c: OllamaConfig) => void;
  onCollapse?: () => void;
  onUpgrade: () => void;
}

interface Artifact {
  id: string;
  kind: "code" | "json" | "markdown";
  language?: string;
  content: string;
  preview: string;
  messageIndex: number;
}

function extractArtifacts(messages: DBMessage[]): Artifact[] {
  const out: Artifact[] = [];
  const fence = /```(\w+)?\n([\s\S]*?)```/g;
  messages.forEach((m, idx) => {
    if (m.role !== "assistant") return;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = fence.exec(m.content)) !== null) {
      const lang = (match[1] || "text").toLowerCase();
      const content = match[2].trim();
      if (content.length < 8) continue;
      const kind: Artifact["kind"] = lang === "json" ? "json" : lang === "md" || lang === "markdown" ? "markdown" : "code";
      out.push({
        id: `${m.id}-${i++}`,
        kind,
        language: lang,
        content,
        preview: content.split("\n").slice(0, 2).join(" ").slice(0, 80),
        messageIndex: idx + 1,
      });
    }
  });
  return out.reverse();
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, icon: Icon, children, count }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; count?: number }) {
  return (
    <section className="px-3 py-3 border-b border-border/60">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{title}</h3>
        </div>
        {typeof count === "number" && (
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniBar({ used, total, color = "primary" }: { used: number; total: number; color?: "primary" | "warn" }) {
  const pct = Math.min(100, total === 0 ? 0 : (used / total) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn("h-full rounded-full", color === "warn" ? "bg-destructive" : "bg-gradient-to-r from-primary to-primary-glow")}
      />
    </div>
  );
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function RightPanel({
  model, isPro, used5h, used24h, limit5h, limit24h, resetAt,
  messages, ollamaConfig, onOllamaChange, onCollapse, onUpgrade,
}: RightPanelProps) {
  const meta = MODEL_META[model];
  const artifacts = useMemo(() => extractArtifacts(messages), [messages]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useState(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  });
  const remaining = resetAt ? resetAt.getTime() - now : 0;

  const firstMsgAt = messages[0]?.created_at;
  const lastMsgAt = messages[messages.length - 1]?.created_at;

  return (
    <aside className="h-full flex flex-col bg-card/40 border-l border-border">
      <div className="flex items-center justify-between px-3 h-12 border-b border-border/60">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Workspace</span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse panel"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Active model */}
        <Section title="Active model" icon={Cpu}>
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 border border-border/60 px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("w-2 h-2 rounded-full shrink-0", meta.colorClass)} />
              <span className="text-sm font-medium truncate">{meta.label}</span>
            </div>
            {model === "ollama" && (
              <OllamaSettings config={ollamaConfig} onChange={onOllamaChange} />
            )}
          </div>
        </Section>

        {/* Usage */}
        <Section title="Usage" icon={Activity}>
          {isPro ? (
            <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 px-2.5 py-2.5">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <div className="text-xs">
                <div className="font-semibold text-foreground">Pro · Unlimited</div>
                <div className="text-muted-foreground text-[11px]">No rolling limits</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">5h window</span>
                  <span className="text-[11px] font-mono tabular-nums text-foreground">{used5h}/{limit5h}</span>
                </div>
                <MiniBar used={used5h} total={limit5h} color={used5h >= limit5h ? "warn" : "primary"} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">24h window</span>
                  <span className="text-[11px] font-mono tabular-nums text-foreground">{used24h}/{limit24h}</span>
                </div>
                <MiniBar used={used24h} total={limit24h} color={used24h >= limit24h ? "warn" : "primary"} />
              </div>
              {resetAt && remaining > 0 && (used5h >= limit5h || used24h >= limit24h) && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <Clock className="w-3 h-3" /> Resets in {formatCountdown(remaining)}
                </div>
              )}
              <button
                onClick={onUpgrade}
                className="w-full mt-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-xs font-medium hover:brightness-110 transition shadow-sm"
              >
                <Zap className="w-3 h-3" />
                Upgrade to Pro
              </button>
            </div>
          )}
        </Section>

        {/* Artifacts */}
        <Section title="Generated artifacts" icon={FileCode2} count={artifacts.length}>
          {artifacts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">Code blocks from AI responses will appear here.</p>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {artifacts.map((a) => {
                  const Icon = a.kind === "json" ? Braces : a.kind === "markdown" ? FileText : FileCode2;
                  const expanded = expandedId === a.id;
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg border border-border/60 bg-secondary/40 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedId(expanded ? null : a.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-secondary/60 transition"
                      >
                        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-mono text-foreground truncate">
                            {a.language || a.kind}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{a.preview}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">#{a.messageIndex}</span>
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-border/60"
                          >
                            <pre className="text-[10.5px] leading-relaxed p-2.5 max-h-48 overflow-auto scrollbar-thin font-mono text-foreground/90 bg-background/40">
{a.content}
                            </pre>
                            <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-t border-border/60 bg-secondary/30">
                              <CopyBtn text={a.content} />
                              <button
                                onClick={() => downloadFile(`artifact-${a.id}.${a.language || "txt"}`, a.content)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                aria-label="Download"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Section>

        {/* Conversation insights */}
        <Section title="Conversation" icon={MessagesSquare}>
          <dl className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Messages</dt>
              <dd className="font-mono tabular-nums">{messages.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Started</dt>
              <dd className="font-mono tabular-nums">{firstMsgAt ? new Date(firstMsgAt).toLocaleDateString() : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Last activity</dt>
              <dd className="font-mono tabular-nums">{lastMsgAt ? new Date(lastMsgAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </aside>
  );
}
