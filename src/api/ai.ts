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

/** What the user can pick in the model picker. "auto" resolves per message. */
export type PickerModel = AIModel | "auto";
export const PRIMARY_PICKER: PickerModel[] = ["auto", "gpt-5", "gemini"];
export const SECONDARY_PICKER: PickerModel[] = ["flash", "ollama"];

/** Model display metadata */
export const MODEL_META: Record<AIModel, { label: string; colorClass: string }> = {
  ollama: { label: "Local (Ollama)", colorClass: "bg-model-orange" },
  flash: { label: "Gemini Flash", colorClass: "bg-model-green" },
  gemini: { label: "Gemini", colorClass: "bg-model-blue" },
  "gpt-5": { label: "GPT", colorClass: "bg-model-purple" },
};

export const PICKER_META: Record<PickerModel, { label: string; hint: string; colorClass: string }> = {
  auto: { label: "Auto", hint: "Picks the best model for each message", colorClass: "bg-primary" },
  "gpt-5": { label: "GPT", hint: "Strong at code and reasoning", colorClass: MODEL_META["gpt-5"].colorClass },
  gemini: { label: "Gemini", hint: "Deep answers, long context", colorClass: MODEL_META.gemini.colorClass },
  flash: { label: "Gemini Flash", hint: "Fastest replies", colorClass: MODEL_META.flash.colorClass },
  ollama: { label: "Local (Ollama)", hint: "Runs on your machine", colorClass: MODEL_META.ollama.colorClass },
};

/**
 * Auto routing: code/build requests → GPT, long/analytical → Gemini, everything else → Flash.
 */
export function resolveModel(picked: PickerModel, text: string): AIModel {
  if (picked !== "auto") return picked;
  const codey = /\b(code|debug|error|function|react|sql|api|typescript|javascript|python|build|app|component|bug|regex)\b/i;
  if (codey.test(text)) return "gpt-5";
  if (text.length > 400 || /\b(analy[sz]e|compare|explain in depth|research|strategy|plan)\b/i.test(text)) return "gemini";
  return "flash";
}
