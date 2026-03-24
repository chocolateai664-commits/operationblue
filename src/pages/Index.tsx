import { useState, useRef, useEffect, useCallback } from "react";
import { ModelSelector, type AIModel } from "@/components/chat/ModelSelector";
import { ModeToggle, type ChatMode } from "@/components/chat/ModeToggle";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CompareView } from "@/components/chat/CompareView";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { streamOllama, checkOllamaHealth } from "@/lib/ollama";
import { Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
}

interface CompareEntry {
  id: string;
  userMessage: string;
  results: { model: string; content: string }[];
}

type ChatEntry =
  | { type: "message"; data: Message }
  | { type: "compare"; data: CompareEntry };

// Mock responses for cloud models (placeholder until backend is wired)
const mockResponses: Record<string, string[]> = {
  flash: [
    "Here's a quick answer! Flash models prioritize speed over depth.",
    "Flash mode activated ⚡ Speed-optimized response ready.",
    "Speed-first response. Flash trades nuance for rapid generation.",
  ],
  gemini: [
    "As Gemini Pro, I provide detailed, nuanced analysis with multi-step reasoning.",
    "Gemini Pro — I excel at complex queries with structured, detailed outputs.",
    "Processing with Gemini Pro. Strong multimodal understanding and context analysis.",
  ],
  "gpt-5": [
    "GPT-5: Advanced reasoning, nuanced context awareness, and sophisticated generation.",
    "GPT-5 brings state-of-the-art deep reasoning and creative generation.",
    "GPT-5 engaged — handling complex queries with high accuracy and nuanced understanding.",
  ],
};

function getRandomResponse(model: string): string {
  const responses = mockResponses[model] || mockResponses["flash"];
  return responses[Math.floor(Math.random() * responses.length)];
}

const Index = () => {
  const [model, setModel] = useState<AIModel>("flash");
  const [mode, setMode] = useState<ChatMode>("single");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check Ollama health on mount and when model changes to ollama
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

  const getModelResponse = useCallback(
    async (targetModel: string, text: string): Promise<string> => {
      if (targetModel === "ollama") {
        return await streamOllama(text);
      }
      // Mock delay + response for cloud models
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      return getRandomResponse(targetModel);
    },
    []
  );

  const handleSend = useCallback(
    async (text: string) => {
      const userEntry: ChatEntry = {
        type: "message",
        data: { id: crypto.randomUUID(), role: "user", content: text },
      };
      setEntries((prev) => [...prev, userEntry]);
      setIsLoading(true);

      try {
        if (mode === "compare") {
          const models: AIModel[] = ["ollama", "flash", "gemini", "gpt-5"];
          const results = await Promise.allSettled(
            models.map(async (m) => ({
              model: m,
              content: await getModelResponse(m, text),
            }))
          );

          const compareEntry: ChatEntry = {
            type: "compare",
            data: {
              id: crypto.randomUUID(),
              userMessage: text,
              results: results.map((r, i) =>
                r.status === "fulfilled"
                  ? r.value
                  : { model: models[i], content: `⚠️ Error: ${(r.reason as Error)?.message || "Failed"}` }
              ),
            },
          };
          setEntries((prev) => [...prev, compareEntry]);
        } else {
          const content = await getModelResponse(model, text);
          const assistantEntry: ChatEntry = {
            type: "message",
            data: {
              id: crypto.randomUUID(),
              role: "assistant",
              content,
              model,
            },
          };
          setEntries((prev) => [...prev, assistantEntry]);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg);
        const errorEntry: ChatEntry = {
          type: "message",
          data: {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ ${errorMsg}`,
            model,
          },
        };
        setEntries((prev) => [...prev, errorEntry]);
      }

      setIsLoading(false);
    },
    [model, mode, getModelResponse]
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-md">
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
        </div>
      </header>

      {/* Ollama status banner */}
      {model === "ollama" && ollamaOnline === false && (
        <div className="flex items-center gap-2 px-6 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>
            Ollama is not running locally. Start it with{" "}
            <code className="font-mono bg-destructive/10 px-1 rounded">ollama serve</code> and make sure a model like{" "}
            <code className="font-mono bg-destructive/10 px-1 rounded">llama3</code> is pulled.
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
                  {" "}Select <strong className="text-model-orange">Ollama</strong> for free local AI.
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
                />
              );
            }
            return <CompareView key={entry.data.id} results={entry.data.results} />;
          })}

          {isLoading && <ThinkingIndicator />}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ChatInput onSend={handleSend} disabled={isLoading} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Multi-AI Chat • Ollama runs locally for free • Cloud models are simulated
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
