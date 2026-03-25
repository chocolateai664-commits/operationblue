/**
 * Centralized AI API Layer
 * All AI model calls route through here — no direct API calls in components.
 */

import { streamChat } from "@/lib/stream-chat";
import { streamOllama } from "@/lib/ollama";

export type AIModel = "ollama" | "flash" | "gemini" | "gpt-5";

export interface StreamOptions {
  model: AIModel;
  prompt: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  ollamaModel?: string;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamAIResponse({
  model,
  prompt,
  conversationHistory,
  ollamaModel = "llama3",
  onDelta,
  onDone,
  onError,
}: StreamOptions): Promise<string> {
  let accumulated = "";

  try {
    if (model === "ollama") {
      accumulated = await streamOllama(prompt, {
        model: ollamaModel,
        onDelta: (chunk) => {
          accumulated += chunk;
          onDelta(chunk);
        },
      });
    } else {
      await streamChat({
        messages: [...conversationHistory, { role: "user", content: prompt }],
        model,
        onDelta: (chunk) => {
          accumulated += chunk;
          onDelta(chunk);
        },
        onDone: () => {},
      });
    }
    onDone();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    onError(msg);
    throw err;
  }

  return accumulated;
}

/** All available models for compare mode */
export const ALL_MODELS: AIModel[] = ["ollama", "flash", "gemini", "gpt-5"];

/** Model display metadata */
export const MODEL_META: Record<AIModel, { label: string; colorClass: string }> = {
  ollama: { label: "Ollama", colorClass: "bg-model-orange" },
  flash: { label: "Flash", colorClass: "bg-model-green" },
  gemini: { label: "Gemini Pro", colorClass: "bg-model-blue" },
  "gpt-5": { label: "GPT-5", colorClass: "bg-model-purple" },
};
