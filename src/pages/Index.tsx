import { useState, useRef, useEffect, useCallback } from "react";
import { ModelSelector, type AIModel } from "@/components/chat/ModelSelector";
import { ModeToggle, type ChatMode } from "@/components/chat/ModeToggle";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CompareView } from "@/components/chat/CompareView";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { OllamaSettings, type OllamaConfig } from "@/components/chat/OllamaSettings";
import { streamOllama, checkOllamaHealth } from "@/lib/ollama";
import { streamChat } from "@/lib/stream-chat";
import { Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  isStreaming?: boolean;
}

interface CompareEntry {
  id: string;
  userMessage: string;
  results: { model: string; content: string; isStreaming?: boolean }[];
}

type ChatEntry =
  | { type: "message"; data: Message }
  | { type: "compare"; data: CompareEntry };

const Index = () => {
  const [model, setModel] = useState<AIModel>("flash");
  const [mode, setMode] = useState<ChatMode>("single");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    baseUrl: "http://localhost:11434",
    model: "llama3",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => {
    if (model === "ollama" || mode === "compare") {
      checkOllamaHealth().then(setOllamaOnline);
    }
  }, [model, mode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isLoading]);

  const getCloudResponse = useCallback(
    async (targetModel: string, text: string, onDelta: (d: string) => void): Promise<string> => {
      let full = "";
      await streamChat({
        messages: [...conversationRef.current, { role: "user", content: text }],
        model: targetModel,
        onDelta: (chunk) => {
          full += chunk;
          onDelta(chunk);
        },
        onDone: () => {},
      });
      return full;
    },
    []
  );

  const getOllamaResponse = useCallback(
    async (text: string, onDelta: (d: string) => void): Promise<string> => {
      return await streamOllama(text, {
        model: ollamaConfig.model,
        onDelta,
      });
    },
    [ollamaConfig.model]
  );

  const handleSend = useCallback(
    async (text: string) => {
      const userEntry: ChatEntry = {
        type: "message",
        data: { id: crypto.randomUUID(), role: "user", content: text },
      };
      setEntries((prev) => [...prev, userEntry]);
      conversationRef.current.push({ role: "user", content: text });
      setIsLoading(true);

      try {
        if (mode === "compare") {
          const models: AIModel[] = ["ollama", "flash", "gemini", "gpt-5"];
          const compareId = crypto.randomUUID();

          // Initialize compare entry
          setEntries((prev) => [
            ...prev,
            {
              type: "compare",
              data: {
                id: compareId,
                userMessage: text,
                results: models.map((m) => ({ model: m, content: "", isStreaming: true })),
              },
            },
          ]);

          const updateCompareResult = (modelName: string, content: string, done: boolean) => {
            setEntries((prev) =>
              prev.map((e) =>
                e.type === "compare" && e.data.id === compareId
                  ? {
                      ...e,
                      data: {
                        ...e.data,
                        results: e.data.results.map((r) =>
                          r.model === modelName ? { ...r, content, isStreaming: !done } : r
                        ),
                      },
                    }
                  : e
              )
            );
          };

          await Promise.allSettled(
            models.map(async (m) => {
              let accumulated = "";
              try {
                if (m === "ollama") {
                  await getOllamaResponse(text, (chunk) => {
                    accumulated += chunk;
                    updateCompareResult(m, accumulated, false);
                  });
                } else {
                  await getCloudResponse(m, text, (chunk) => {
                    accumulated += chunk;
                    updateCompareResult(m, accumulated, false);
                  });
                }
                updateCompareResult(m, accumulated, true);
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed";
                updateCompareResult(m, `⚠️ ${msg}`, true);
              }
            })
          );
        } else {
          // Single mode with streaming
          const assistantId = crypto.randomUUID();
          setEntries((prev) => [
            ...prev,
            {
              type: "message",
              data: { id: assistantId, role: "assistant", content: "", model, isStreaming: true },
            },
          ]);

          let accumulated = "";
          const updateAssistant = (content: string, streaming: boolean) => {
            setEntries((prev) =>
              prev.map((e) =>
                e.type === "message" && e.data.id === assistantId
                  ? { ...e, data: { ...e.data, content, isStreaming: streaming } }
                  : e
              )
            );
          };

          if (model === "ollama") {
            accumulated = await getOllamaResponse(text, (chunk) => {
              accumulated += chunk;
              updateAssistant(accumulated, true);
            });
          } else {
            accumulated = await getCloudResponse(model, text, (chunk) => {
              accumulated += chunk;
              updateAssistant(accumulated, true);
            });
          }

          updateAssistant(accumulated, false);
          conversationRef.current.push({ role: "assistant", content: accumulated });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg);
        setEntries((prev) => [
          ...prev,
          {
            type: "message",
            data: { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${errorMsg}`, model },
          },
        ]);
      }

      setIsLoading(false);
    },
    [model, mode, getCloudResponse, getOllamaResponse]
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-base font-semibold tracking-tight">Multi-AI Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector selected={model} onSelect={setModel} />
          <div className="w-px h-6 bg-border" />
          <ModeToggle mode={mode} onToggle={setMode} />
          <div className="w-px h-6 bg-border" />
          <OllamaSettings config={ollamaConfig} onChange={setOllamaConfig} />
        </div>
      </header>

      {/* Ollama status banner */}
      {model === "ollama" && ollamaOnline === false && (
        <div className="flex items-center gap-2 px-6 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>
            Ollama is not running. Start with{" "}
            <code className="font-mono bg-destructive/10 px-1 rounded">ollama serve</code> and pull a model like{" "}
            <code className="font-mono bg-destructive/10 px-1 rounded">{ollamaConfig.model}</code>.
          </span>
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-1">What can I help you with?</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Choose a model, pick single or compare mode, and start chatting.
                  Cloud models stream real responses. Select{" "}
                  <strong className="text-model-orange">Ollama</strong> for free local AI.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {["Explain quantum computing", "Write a Python script", "Compare AI models"].map(
                  (prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSend(prompt)}
                      className="px-4 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {prompt}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {entries.map((entry) => {
            if (entry.type === "message") {
              return (
                <ChatMessage
                  key={entry.data.id}
                  role={entry.data.role}
                  content={entry.data.content}
                  model={entry.data.model}
                  isStreaming={entry.data.isStreaming}
                />
              );
            }
            return <CompareView key={entry.data.id} results={entry.data.results} />;
          })}

          {isLoading && entries.every((e) => e.type !== "message" || !e.data.isStreaming) && (
            <ThinkingIndicator />
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ChatInput onSend={handleSend} disabled={isLoading} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Multi-AI Chat • Flash, Gemini & GPT-5 powered by Lovable AI • Ollama runs locally for free
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
