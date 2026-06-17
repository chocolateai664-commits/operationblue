/**
 * Centralized AI API Layer
 * All AI model calls route through here — no direct API calls in components.
 */

import { streamChat, StreamAbortedError } from "@/lib/stream-chat";
import { streamOllama } from "@/lib/ollama";

export type AIModel = "ollama" | "flash" | "gemini" | "gpt-5";

export interface StreamOptions {
  model: AIModel;
  prompt: string;
  /** Slid-window history NOT including the current prompt. */
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  /** Optional pre-built system prompt (base + summary). */
  system?: string;
  ollamaModel?: string;
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export { StreamAbortedError };

export async function streamAIResponse({
  model,
  prompt,
  conversationHistory,
  system,
  ollamaModel = "llama3",
  signal,
  onDelta,
  onDone,
  onError,
}: StreamOptions): Promise<string> {
  let accumulated = "";

  try {
    if (model === "ollama") {
      accumulated = await streamOllama(prompt, {
        model: ollamaModel,
        system,
        signal,
        onDelta: (chunk) => {
          accumulated += chunk;
          onDelta(chunk);
        },
      });
    } else {
      await streamChat({
        messages: [...conversationHistory, { role: "user", content: prompt }],
        model,
        system,
        signal,
        onDelta: (chunk) => {
          accumulated += chunk;
          onDelta(chunk);
        },
        onDone: () => {},
      });
    }
    onDone();
  } catch (err) {
    if (err instanceof StreamAbortedError || (err as Error)?.name === "AbortError") {
      // Caller decides how to render partial output; don't toast.
      throw err;
    }
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
