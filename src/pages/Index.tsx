import { useState, useRef, useEffect, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { motion, AnimatePresence } from "framer-motion";
import { ModeToggle, type ChatMode } from "@/components/chat/ModeToggle";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CompareView } from "@/components/chat/CompareView";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { type OllamaConfig } from "@/components/chat/OllamaSettings";
import { LeftSidebar } from "@/components/workspace/LeftSidebar";
import { RightPanel } from "@/components/workspace/RightPanel";
import { UpgradePrompt } from "@/components/chat/UpgradePrompt";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { streamAIResponse, ALL_MODELS, MODEL_META, StreamAbortedError, type AIModel } from "@/api/ai";
import { checkOllamaHealth, setOllamaBase } from "@/lib/ollama";
import { buildContextWindow, shouldGenerateSummary, messagesToSummarize, type MemoryMessage } from "@/utils/conversationMemory";
import { Sparkles, AlertCircle, PanelLeft, PanelRight, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface LocalEntry {
  id: string;
  type: "message" | "compare";
  role?: "user" | "assistant";
  content?: string;
  model?: string;
  isStreaming?: boolean;
  results?: { model: string; content: string; isStreaming?: boolean }[];
  userMessage?: string;
}

const LS_LAYOUT = "optineural:layout-v1";
const LS_LEFT_OPEN = "optineural:left-open";
const LS_RIGHT_OPEN = "optineural:right-open";

const Index = () => {
  const { signOut } = useAuth();
  const { conversations, activeId, setActiveId, createConversation, deleteConversation, updateSummary } = useConversations();
  const { messages: dbMessages, loadMessages, saveMessage, clearMessages } = useMessages();
  const { canUseAI, remainingFree, used5h, used24h, FREE_LIMIT, FREE_LIMIT_24H, resetAt, refresh: refreshUsage, isPro } = useUsageTracking();
  const navigate = useNavigate();

  const [model, setModel] = useState<AIModel>("flash");
  const [mode, setMode] = useState<ChatMode>("single");
  const [liveEntries, setLiveEntries] = useState<LocalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  const [leftOpen, setLeftOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(LS_LEFT_OPEN);
    return v === null ? true : v === "1";
  });
  const [rightOpen, setRightOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(LS_RIGHT_OPEN);
    return v === null ? true : v === "1";
  });
  const [mobileDrawer, setMobileDrawer] = useState<"left" | "right" | null>(null);

  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    baseUrl: "http://localhost:11434",
    model: "llama3",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<MemoryMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => localStorage.setItem(LS_LEFT_OPEN, leftOpen ? "1" : "0"), [leftOpen]);
  useEffect(() => localStorage.setItem(LS_RIGHT_OPEN, rightOpen ? "1" : "0"), [rightOpen]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      setLiveEntries([]);
    } else {
      clearMessages();
      setLiveEntries([]);
    }
    conversationRef.current = [];
  }, [activeId, loadMessages, clearMessages]);

  useEffect(() => {
    conversationRef.current = dbMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [dbMessages]);

  useEffect(() => {
    if (model === "ollama" || mode === "compare") {
      checkOllamaHealth().then(setOllamaOnline);
    }
  }, [model, mode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [liveEntries, dbMessages, isLoading]);

  const handleOllamaConfigChange = useCallback((config: OllamaConfig) => {
    setOllamaConfig(config);
    setOllamaBase(config.baseUrl);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    clearMessages();
    setLiveEntries([]);
    conversationRef.current = [];
    setMobileDrawer(null);
  }, [setActiveId, clearMessages]);

  const handleSelectConv = useCallback((id: string) => {
    setActiveId(id);
    setMobileDrawer(null);
  }, [setActiveId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const maybeGenerateSummary = useCallback(
    async (convId: string) => {
      const conv = conversations.find((c) => c.id === convId);
      const total = conversationRef.current.length;
      const covered = conv?.summary_message_count ?? 0;
      if (!shouldGenerateSummary(total, covered)) return;

      const older = messagesToSummarize(conversationRef.current);
      if (older.length === 0) return;
      const transcript = older
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      try {
        const { data, error } = await supabase.functions.invoke("summarize", {
          body: { chunks: [transcript] },
        });
        if (error) throw error;
        const summary = (data?.summary as string | undefined)?.trim();
        if (summary) await updateSummary(convId, summary, older.length);
      } catch (e) {
        console.warn("Conversation summary failed:", e);
      }
    },
    [conversations, updateSummary]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!canUseAI) return;

      let convId = activeId;
      if (!convId) {
        const titlePreview = text.slice(0, 40) + (text.length > 40 ? "…" : "");
        convId = await createConversation(titlePreview);
        if (!convId) return;
      }

      const userSave = await saveMessage(convId, "user", text);
      if (!userSave.ok) {
        // Persistence failed — surface and abort so we don't pretend the message was saved.
        return;
      }
      conversationRef.current.push({ role: "user", content: text });
      setIsLoading(true);
      refreshUsage();

      const activeConv = conversations.find((c) => c.id === convId);
      const summary = activeConv?.summary ?? null;
      const priorHistory = conversationRef.current.slice(0, -1);

      try {
        if (mode === "compare") {
          const compareId = crypto.randomUUID();
          const entry: LocalEntry = {
            id: compareId,
            type: "compare",
            userMessage: text,
            results: ALL_MODELS.map((m) => ({ model: m, content: "", isStreaming: true })),
          };
          setLiveEntries((prev) => [...prev, entry]);

          const updateResult = (modelName: string, content: string, done: boolean) => {
            setLiveEntries((prev) =>
              prev.map((e) =>
                e.id === compareId
                  ? { ...e, results: e.results!.map((r) => (r.model === modelName ? { ...r, content, isStreaming: !done } : r)) }
                  : e
              )
            );
          };

          const controller = new AbortController();
          abortRef.current = controller;

          const window = buildContextWindow(priorHistory, summary, text);

          await Promise.allSettled(
            ALL_MODELS.map(async (m) => {
              let accumulated = "";
              try {
                await streamAIResponse({
                  model: m,
                  prompt: text,
                  conversationHistory: window.messages.slice(0, -1),
                  system: window.system,
                  ollamaModel: ollamaConfig.model,
                  signal: controller.signal,
                  onDelta: (chunk) => { accumulated += chunk; updateResult(m, accumulated, false); },
                  onDone: () => updateResult(m, accumulated, true),
                  onError: (msg) => updateResult(m, `⚠️ ${msg}`, true),
                });
              } catch (err) {
                if (err instanceof StreamAbortedError) {
                  updateResult(m, accumulated + "\n\n_Stopped._", true);
                }
              }
            })
          );
        } else {
          const assistantId = crypto.randomUUID();
          setLiveEntries((prev) => [
            ...prev,
            { id: assistantId, type: "message", role: "assistant", content: "", model, isStreaming: true },
          ]);

          let accumulated = "";
          const update = (content: string, streaming: boolean) => {
            setLiveEntries((prev) =>
              prev.map((e) => (e.id === assistantId ? { ...e, content, isStreaming: streaming } : e))
            );
          };

          const runOnce = async (history: MemoryMessage[], recent?: number) => {
            const controller = new AbortController();
            abortRef.current = controller;
            const window = buildContextWindow(history, summary, text, recent ? { recent } : {});
            return streamAIResponse({
              model,
              prompt: text,
              conversationHistory: window.messages.slice(0, -1),
              system: window.system,
              ollamaModel: ollamaConfig.model,
              signal: controller.signal,
              onDelta: (chunk) => { accumulated += chunk; update(accumulated, true); },
              onDone: () => {},
              onError: () => {}, // we re-throw and decide below
            });
          };

          let aborted = false;
          try {
            accumulated = await runOnce(priorHistory);
          } catch (err) {
            if (err instanceof StreamAbortedError) {
              aborted = true;
            } else {
              const msg = err instanceof Error ? err.message : "Unknown error";
              // Don't retry quota errors or auth errors
              if (/QUOTA|Limit reached|Unauthorized|sign(ed)? in/i.test(msg)) {
                throw err;
              }
              // Retry once with a smaller window
              console.warn("Chat stream failed, retrying with smaller context:", msg);
              accumulated = "";
              update("", true);
              try {
                accumulated = await runOnce(priorHistory, 2);
              } catch (err2) {
                if (err2 instanceof StreamAbortedError) aborted = true;
                else throw err2;
              }
            }
          }

          const final = aborted && accumulated ? `${accumulated}\n\n_Stopped._` : accumulated;
          update(final, false);
          if (final.trim()) {
            const saved = await saveMessage(convId, "assistant", final, model);
            if (saved.ok) {
              conversationRef.current.push({ role: "assistant", content: final });
            }
          }
          setLiveEntries((prev) => prev.filter((e) => e.id !== assistantId));

          if (!aborted && final.trim()) {
            void maybeGenerateSummary(convId);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unknown error");
        refreshUsage();
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [model, mode, ollamaConfig.model, activeId, canUseAI, conversations, createConversation, saveMessage, refreshUsage, maybeGenerateSummary]
  );

  const showUpgrade = !canUseAI;
  const meta = MODEL_META[model];

  const sidebarNode = (
    <LeftSidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConv}
      onNew={handleNewChat}
      onDelete={deleteConversation}
      isPro={isPro}
      selectedModel={model}
      onSelectModel={setModel}
      onCollapse={() => setLeftOpen(false)}
      onSignOut={signOut}
    />
  );

  const rightNode = (
    <RightPanel
      model={model}
      isPro={isPro}
      used5h={used5h}
      used24h={used24h}
      limit5h={FREE_LIMIT}
      limit24h={FREE_LIMIT_24H}
      resetAt={resetAt}
      messages={dbMessages}
      ollamaConfig={ollamaConfig}
      onOllamaChange={handleOllamaConfigChange}
      onCollapse={() => setRightOpen(false)}
      onUpgrade={() => navigate("/pricing")}
    />
  );

  const centerNode = (
    <div className="flex flex-col h-full bg-gradient-subtle">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 glass shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileDrawer("left")}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          {/* Desktop sidebar toggle */}
          {!leftOpen && (
            <button
              onClick={() => setLeftOpen(true)}
              className="hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 ml-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", meta.colorClass)} />
            <span className="text-[12px] font-medium text-foreground/90">{meta.label}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">
              {activeId
                ? conversations.find((c) => c.id === activeId)?.title ?? "Chat"
                : "New conversation"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle mode={mode} onToggle={setMode} />
          {!isPro && (
            <span className="hidden md:inline text-[11px] text-muted-foreground font-mono tabular-nums">
              {used5h}/{FREE_LIMIT}
            </span>
          )}
          <button
            onClick={() => setMobileDrawer("right")}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Open workspace panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>
          {!rightOpen && (
            <button
              onClick={() => setRightOpen(true)}
              className="hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Open workspace panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Ollama banner */}
      {model === "ollama" && ollamaOnline === false && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>
            Ollama is not running. Start with <code className="font-mono bg-destructive/20 px-1.5 py-0.5 rounded">ollama serve</code>.
          </span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[820px] mx-auto px-5 sm:px-8">
          {dbMessages.length === 0 && liveEntries.length === 0 && !showUpgrade && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5 py-12"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary-glow/20 blur-2xl rounded-full" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-glow">
                  <Sparkles className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-balance">What can I help you build?</h1>
                <p className="text-sm text-muted-foreground max-w-md text-balance">
                  Choose a model, pick single or compare mode, and start a conversation.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-xl">
                {[
                  "Explain how Rust ownership works",
                  "Write a Python script to parse CSV",
                  "Compare React Server Components vs SSR",
                  "Design a Postgres schema for chat history",
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    className="px-3.5 py-2 rounded-xl border border-border bg-card/40 hover:bg-card hover:border-border-strong text-xs text-muted-foreground hover:text-foreground transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {dbMessages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} model={msg.model ?? undefined} />
          ))}

          {liveEntries.map((entry) => {
            if (entry.type === "compare" && entry.results) {
              return <CompareView key={entry.id} results={entry.results} />;
            }
            return (
              <ChatMessage
                key={entry.id}
                role={entry.role!}
                content={entry.content!}
                model={entry.model}
                isStreaming={entry.isStreaming}
              />
            );
          })}

          {isLoading && liveEntries.every((e) => !e.isStreaming) && <ThinkingIndicator />}

          {showUpgrade && (
            <UpgradePrompt usedCount={used5h} limit={FREE_LIMIT} resetAt={resetAt} used24h={used24h} limit24h={FREE_LIMIT_24H} />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-[820px] mx-auto">
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-elevated p-2">
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isLoading}
              disabled={showUpgrade}
            />
          </div>
          <p className="text-[10.5px] text-muted-foreground/80 text-center mt-2">
            {isPro
              ? "Pro · unlimited messages"
              : `${remainingFree} of ${FREE_LIMIT} messages left in this 5h window`}
            {" · "}
            <span className="font-mono">{meta.label}</span>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen-safe bg-background text-foreground overflow-hidden">
      {/* Desktop: resizable 3-panel */}
      <div className="hidden lg:block h-full">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId={LS_LAYOUT}
          className="h-full"
        >
          {leftOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={14} maxSize={28} order={1} id="left">
                {sidebarNode}
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          <ResizablePanel defaultSize={rightOpen ? 60 : 82} minSize={40} order={2} id="center">
            {centerNode}
          </ResizablePanel>
          {rightOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={22} minSize={16} maxSize={34} order={3} id="right">
                {rightNode}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Mobile / tablet: single column with drawers */}
      <div className="lg:hidden h-full">
        {centerNode}
        <AnimatePresence>
          {mobileDrawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileDrawer(null)}
                className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: mobileDrawer === "left" ? "-100%" : "100%" }}
                animate={{ x: 0 }}
                exit={{ x: mobileDrawer === "left" ? "-100%" : "100%" }}
                transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "fixed top-0 bottom-0 z-50 w-[85vw] max-w-[320px]",
                  mobileDrawer === "left" ? "left-0" : "right-0"
                )}
              >
                <button
                  onClick={() => setMobileDrawer(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-secondary/80 text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
                {mobileDrawer === "left" ? sidebarNode : rightNode}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
