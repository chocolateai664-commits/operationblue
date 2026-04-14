/**
 * Token estimation and cost calculation utilities
 */

import type { AIModel } from "@/api/ai";

/** Approximate token count from text length */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Cost per 1M tokens (input / output) in USD */
const PRICING: Record<string, { input: number; output: number }> = {
  flash:   { input: 0.15,  output: 0.60 },   // gemini-3-flash-preview
  gemini:  { input: 1.25,  output: 10.00 },   // gemini-2.5-pro
  "gpt-5": { input: 2.00,  output: 8.00 },    // openai/gpt-5
  ollama:  { input: 0,     output: 0 },        // local, free
};

/** Calculate cost in USD for a request */
export function calculateCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICING[model] ?? PRICING.flash;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
