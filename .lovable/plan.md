

## Plan: Upgrade System Prompt and Increase Output Limits

The user's code snippet contains two key improvements to integrate: a much richer system prompt and higher max output tokens. The refinement pass (second API call) is intentionally excluded — it doubles cost and latency with marginal benefit when the system prompt already enforces quality.

### Changes

**1. Edge Function — `supabase/functions/chat/index.ts`**

- Replace the current one-liner system prompt with the detailed prompt from the user's snippet (structured, complete answers, step-by-step reasoning, self-review before responding)
- Increase `MAX_OUTPUT_TOKENS` from `800` to `1500` to allow fuller responses
- Update `temperature` to `0.7` for slightly more natural output

**2. No other files change** — the system prompt lives server-side only (as required by security guidelines). The client-side `src/api/ai.ts` and `src/lib/stream-chat.ts` remain untouched.

### What We Skip (and Why)

| From user's snippet | Decision |
|---|---|
| `refineOutput()` second-pass call | Skip — doubles cost per request, adds latency. The improved system prompt achieves the same quality boost. |
| Direct `/api/gemini` and `/api/gpt` routes | Skip — already routed through the Lovable AI Gateway edge function. |
| Client-side model routing (`callGemini`, `callGPT`) | Skip — existing architecture already handles this server-side. |

### Files to Edit

| File | Change |
|---|---|
| `supabase/functions/chat/index.ts` | New system prompt, `MAX_OUTPUT_TOKENS` → 1500, add `temperature: 0.7` |

