import { useState, useRef, useEffect, useCallback } from "react";
import { ModelSelector, type AIModel } from "@/components/chat/ModelSelector";
import { ModeToggle, type ChatMode } from "@/components/chat/ModeToggle";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { CompareView } from "@/components/chat/CompareView";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { Sparkles } from "lucide-react";

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

// Simulated responses per model
const mockResponses: Record<string, string[]> = {
  flash: [
    "Here's a quick answer! Flash models prioritize speed over depth. This response was generated in milliseconds.",
    "Flash mode activated ⚡ I process requests at lightning speed with optimized inference.",
    "Speed-optimized response ready. Flash models trade some nuance for rapid generation.",
  ],
  gemini: [
    "As a Gemini Pro model, I can provide detailed, nuanced analysis. Let me break this down comprehensively with multiple perspectives and thorough reasoning.",
    "Gemini Pro here — I excel at multi-step reasoning and can handle complex queries with structured, detailed outputs.",
    "Processing with Gemini Pro capabilities. I offer strong multimodal understanding and extended context analysis.",
  ],
  "gpt-5": [
    "GPT-5 response: I represent the frontier of language understanding. My responses leverage advanced reasoning, nuanced context awareness, and sophisticated language generation.",
    "As GPT-5, I bring state-of-the-art capabilities including deep reasoning, creative generation, and precise instruction following.",
    "GPT-5 engaged — I can handle complex, multi-faceted queries with high accuracy and nuanced understanding of context and intent.",
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isLoading]);

  const handleSend = useCallback(
    async (text: string) => {
      const userEntry: ChatEntry = {
        type: "message",
        data: { id: crypto.randomUUID(), role: "user", content: text },
      };
      setEntries((prev) => [...prev, userEntry]);
      setIsLoading(true);

      // Simulate API delay
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

      if (mode === "compare") {
        const compareEntry: ChatEntry = {
          type: "compare",
          data: {
            id: crypto.randomUUID(),
            userMessage: text,
            results: (["flash", "gemini", "gpt-5"] as const).map((m) => ({
              model: m,
              content: getRandomResponse(m),
            })),
          },
        };
        setEntries((prev) => [...prev, compareEntry]);
      } else {
        const assistantEntry: ChatEntry = {
          type: "message",
          data: {
            id: crypto.randomUUID(),
            role: "assistant",
            content: getRandomResponse(model),
            model,
          },
        };
        setEntries((prev) => [...prev, assistantEntry]);
      }

      setIsLoading(false);
    },
    [model, mode]
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
            Multi-AI Chat can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
