/**
 * Conversation memory & system-prompt builder.
 *
 * Replaces "send the whole history every turn" with:
 *   system prompt + (optional) running summary + last N messages + current input
 *
 * Also detects coding/builder intent so we can swap to a more compact prompt.
 */

export const RECENT_WINDOW = 6;
export const SUMMARY_TRIGGER = 20;
export const SUMMARY_KEEP_RECENT = 8;

const CODE_KEYWORDS =
  /\b(code|javascript|typescript|react|node|sql|api|debug|error|function|class|component|bug|stack ?trace|exception|compile|syntax|regex|python|java|c\+\+|rust|go(?:lang)?|html|css|tailwind|express|next\.?js|vite|deno)\b/i;
const BUILDER_KEYWORDS =
  /\b(build (?:a |the |me |us )?(?:complete|full|entire|whole) (?:app|application|project|website|system)|generate (?:a |the )?(?:full|complete|entire) (?:app|project)|scaffold (?:a|the) (?:project|app)|create (?:the )?(?:entire|whole|complete) (?:app|project))\b/i;

export type ConversationMode = "default" | "coding" | "builder";

export function detectMode(text: string): ConversationMode {
  if (BUILDER_KEYWORDS.test(text)) return "builder";
  if (CODE_KEYWORDS.test(text)) return "coding";
  return "default";
}

const BASE_PROMPT = `You are a precise, implementation-focused AI assistant.

Defaults:
- Keep replies under 300 words.
- Keep code under 50 lines and show only the relevant snippet.
- Prefer bullet points and concrete examples over prose.
- Do not repeat explanations already given in this conversation.
- Do not generate full applications unless the user explicitly asks.
- Preserve markdown formatting.`;

const CODING_PROMPT = `${BASE_PROMPT}

Coding mode is active:
- Return a minimal working solution (≤50 lines of code).
- Explain only what changed and why, in 2–4 bullets.
- Skip boilerplate, unchanged imports, and unrelated files.
- Focus on the bug or feature in front of you.`;

const BUILDER_PROMPT = `You are an expert software builder.
The user explicitly asked for a complete implementation, so longer responses are allowed.
Still prefer clean, modular, well-structured code and skip filler prose.`;

export function systemPromptFor(mode: ConversationMode): string {
  if (mode === "coding") return CODING_PROMPT;
  if (mode === "builder") return BUILDER_PROMPT;
  return BASE_PROMPT;
}

export interface MemoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ContextWindow {
  system: string;
  messages: MemoryMessage[];
  mode: ConversationMode;
}

/**
 * Build the request payload from full history + summary + the new user input.
 * The returned `messages` array is what should be sent to the model; `system`
 * is the merged system prompt (base prompt + summary block when present).
 */
export function buildContextWindow(
  allMessages: MemoryMessage[],
  summary: string | null,
  currentUserMessage: string,
  opts: { recent?: number; modeOverride?: ConversationMode } = {}
): ContextWindow {
  const recent = opts.recent ?? RECENT_WINDOW;
  const mode = opts.modeOverride ?? detectMode(currentUserMessage);

  const tail = allMessages.slice(-recent);
  const parts = [systemPromptFor(mode)];
  if (summary?.trim()) {
    parts.push(`Conversation summary so far (older turns, compressed):\n${summary.trim()}`);
  }

  return {
    system: parts.join("\n\n"),
    mode,
    messages: [...tail, { role: "user", content: currentUserMessage }],
  };
}

/** True when we should fold older messages into a fresh summary. */
export function shouldGenerateSummary(totalMessages: number, summaryMsgCount: number): boolean {
  if (totalMessages < SUMMARY_TRIGGER) return false;
  return totalMessages - summaryMsgCount >= RECENT_WINDOW + 4;
}

/** Returns the messages that should be folded into the summary (older ones, leaving the recent tail intact). */
export function messagesToSummarize(allMessages: MemoryMessage[]): MemoryMessage[] {
  if (allMessages.length <= SUMMARY_KEEP_RECENT) return [];
  return allMessages.slice(0, allMessages.length - SUMMARY_KEEP_RECENT);
}
