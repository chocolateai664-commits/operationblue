import { useState, useRef, useEffect, useCallback } from "react";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { ModeToggle, type ChatMode } from "@/components/chat/ModeToggle";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CompareView } from "@/components/chat/CompareView";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { OllamaSettings, type OllamaConfig } from "@/components/chat/OllamaSettings";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { UpgradePrompt } from "@/components/chat/UpgradePrompt";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { streamAIResponse, ALL_MODELS, type AIModel } from "@/api/ai";
import { checkOllamaHealth, setOllamaBase } from "@/lib/ollama";
import { Sparkles, AlertCircle, LogOut, PanelLeftClose, PanelLeft, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

const Index = () => {
  const { signOut } = useAuth();
  const { conversations, activeId, setActiveId, createConversation, updateTitle, deleteConversation } = useConversations();
  const { messages: dbMessages, loadMessages, saveMessage, clearMessages } = useMessages();
  const { canUseAI, remainingFree, used5h, used24h, FREE_LIMIT, FREE_LIMIT_24H, resetAt, refresh: refreshUsage, isPro } = useUsageTracking();
  const navigate = useNavigate();

  const [model, setModel] = useState<AIModel>("flash");
  const [mode, setMode] = useState<ChatMode>("single");
  const [liveEntries, setLiveEntries] = useState<LocalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    baseUrl: "http://localhost:11434",
    model: "llama3",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  // Load messages when active conversation changes
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

  // Rebuild conversation history from DB messages
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
  }, [setActiveId, clearMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!canUseAI) return;

      // Ensure we have a conversation
      let convId = activeId;
      if (!convId) {
        const titlePreview = text.slice(0, 40) + (text.length > 40 ? "…" : "");
        convId = await createConversation(titlePreview);
        if (!convId) return;
      }

      // Save user message to DB
      await saveMessage(convId, "user", text);
      conversationRef.current.push({ role: "user", content: text });
      setIsLoading(true);

      // Refresh rolling usage in the background
      refreshUsage();

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

          await Promise.allSettled(
            ALL_MODELS.map(async (m) => {
              let accumulated = "";
              try {
                await streamAIResponse({
                  model: m,
                  prompt: text,
                  conversationHistory: conversationRef.current.slice(0, -1),
                  ollamaModel: ollamaConfig.model,
                  onDelta: (chunk) => { accumulated += chunk; updateResult(m, accumulated, false); },
                  onDone: () => updateResult(m, accumulated, true),
                  onError: (msg) => updateResult(m, `⚠️ ${msg}`, true),
                });
              } catch { /* handled */ }
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

          accumulated = await streamAIResponse({
            model,
            prompt: text,
            conversationHistory: conversationRef.current.slice(0, -1),
            ollamaModel: ollamaConfig.model,
            onDelta: (chunk) => { accumulated += chunk; update(accumulated, true); },
            onDone: () => {},
            onError: (msg) => toast.error(msg),
          });

          update(accumulated, false);
          // Save assistant message to DB
          await saveMessage(convId, "assistant", accumulated, model);
          conversationRef.current.push({ role: "assistant", content: accumulated });
          // Remove from live entries since it's now in DB
          setLiveEntries((prev) => prev.filter((e) => e.id !== assistantId));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unknown error");
      }

      setIsLoading(false);
    },
    [model, mode, ollamaConfig.model, activeId, canUseAI, createConversation, saveMessage, refreshUsage]
  );

  const showUpgrade = !canUseAI;

  return (
    <div className="flex h-screen-safe">
      {/* Sidebar */}
      {sidebarOpen && (
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={handleNewChat}
          onDelete={deleteConversation}
          isPro={isPro}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="relative flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight">OptiNeural</h1>
            {!showUpgrade && (
              <span className="text-[10px] text-muted-foreground ml-2">{remainingFree} free left</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector selected={model} onSelect={setModel} />
            <div className="w-px h-5 bg-border" />
            <ModeToggle mode={mode} onToggle={setMode} />
            <div className="w-px h-5 bg-border" />
            <OllamaSettings config={ollamaConfig} onChange={handleOllamaConfigChange} />
            <div className="w-px h-5 bg-border" />
            <button
              onClick={() => navigate("/pricing")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Pricing"
            >
              <Crown className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-border" />
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Ollama banner */}
        {model === "ollama" && ollamaOnline === false && (
          <div className="flex items-center gap-2 px-6 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              Ollama is not running. Start with <code className="font-mono bg-destructive/10 px-1 rounded">ollama serve</code>.
            </span>
          </div>
        )}

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4">
            {dbMessages.length === 0 && liveEntries.length === 0 && !showUpgrade && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">What can I help you with?</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Choose a model, pick single or compare mode, and start chatting.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {["Explain quantum computing", "Write a Python script", "Compare AI models"].map((p) => (
                    <button key={p} onClick={() => handleSend(p)} className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DB messages (persisted) */}
            {dbMessages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} model={msg.model ?? undefined} />
            ))}

            {/* Live streaming entries */}
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

            {showUpgrade && <UpgradePrompt usedCount={used5h} limit={FREE_LIMIT} resetAt={resetAt} used24h={used24h} limit24h={FREE_LIMIT_24H} />}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card/50 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <ChatInput onSend={handleSend} disabled={isLoading || showUpgrade} />
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              OptiNeural • {remainingFree} free requests remaining
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
