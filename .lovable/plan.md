# Run Operation Blue locally and on Vercel (hybrid AI)

Yes — the app can run locally and deploy to Vercel. The frontend is a standard Vite + React SPA, and the backend already lives in Supabase (Edge Functions + Postgres), which is independent of Lovable hosting. The only Lovable-specific piece is the AI Gateway call inside `supabase/functions/chat/index.ts`, which we'll make swappable so you can run in **hybrid mode**: Lovable Gateway when `LOVABLE_API_KEY` is present, your own OpenAI / Gemini keys otherwise.

## What works as-is

- `src/` — pure Vite/React, no Lovable runtime dependency.
- Supabase client (`src/integrations/supabase/client.ts`) — reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`. Works anywhere.
- Auth, RLS, RPCs (`check_rolling_quota`, `increment_usage`, `log_request`), conversations/messages tables — all hosted on your Supabase project, unaffected.
- Edge Functions (`chat`, `summarize`, `check-subscription`, `create-checkout`, `customer-portal`) — already deployed to Supabase; we'll keep deploying them there via Supabase CLI.

## What needs adapting

### 1. Local dev environment
- Keep the existing `.env` (it already has the Supabase URL + anon key).
- Add `bun install` (or `npm install`) → `bun run dev` → Vite serves on `http://localhost:8080`.
- Install Supabase CLI to deploy edge functions: `npm i -g supabase`, then `supabase link --project-ref iuqrxursqqqicylynxph` and `supabase functions deploy chat summarize check-subscription create-checkout customer-portal`.

### 2. Vercel deployment
- Framework preset: **Vite**.
- Build command: `bun run build` (or `npm run build`); output: `dist`.
- Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` as Vercel env vars.
- Add `vercel.json` with SPA fallback so deep links (`/chat`, `/auth`, `/pricing`) don't 404:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
  ```
- Remove `lovable-tagger` from prod build (it's already dev-only in `vite.config.ts`, so this is fine — no change needed).

### 3. Hybrid AI gateway (the only real code change)
Refactor `supabase/functions/chat/index.ts` to pick a provider at runtime based on which secrets are set in Supabase:

| Secret present | Provider used | Endpoint |
|---|---|---|
| `LOVABLE_API_KEY` | Lovable AI Gateway (current behavior) | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| `OPENAI_API_KEY` (and `LOVABLE_API_KEY` absent or model starts with `openai/`) | OpenAI direct | `https://api.openai.com/v1/chat/completions` |
| `GEMINI_API_KEY` (and model is `flash`/`gemini`) | Google Generative Language API | `https://generativelanguage.googleapis.com/v1beta/...` |

Logic:
- Keep the existing `modelMap` (`flash`, `gemini`, `gpt-5`).
- Add a `resolveProvider(model)` function that returns `{ url, headers, body, parseStream }`.
- Preserve the SSE streaming shape the frontend already expects (`data: {choices:[{delta:{content}}]}\n\n`); for Gemini direct, translate its stream chunks into that shape inside the function before piping to the client.
- All quota/usage/auth/RPC logic stays untouched.

### 4. Secrets management
- Local: store provider keys in Supabase project secrets (`supabase secrets set OPENAI_API_KEY=... GEMINI_API_KEY=...`). They are read by the edge function at runtime — never in the Vite `.env` and never shipped to the browser.
- Vercel only needs the `VITE_*` Supabase vars (frontend). AI keys live on Supabase, not Vercel.

### 5. Optional cleanup
- Delete `.lovable/` directory and `lovable-tagger` dev dependency once you've fully detached (not required for things to work).
- The `vite.config.ts` `componentTagger()` plugin is already gated to `mode === "development"`, so prod builds on Vercel are clean.

## Files to change

| File | Change |
|---|---|
| `supabase/functions/chat/index.ts` | Add provider resolver, support OpenAI + Gemini direct as fallbacks, translate streams into OpenAI SSE shape |
| `vercel.json` (new) | SPA rewrite rule |
| `README.md` | Add Local Dev + Vercel + Supabase CLI sections, document required env vars and Supabase secrets |

## What I will NOT touch

- Frontend code (`src/`) — works as-is on Vercel.
- Supabase schema, RLS policies, RPCs.
- Other edge functions (`summarize`, Stripe ones) — they don't use Lovable services.
- Auth flow, subscriptions, chat history, compare mode, model selector UI.

## Risks

- **Stream format translation** for Gemini direct is the only non-trivial work; it needs to match the parser in `src/lib/stream-chat.ts` exactly. Low risk because the parser already tolerates partial JSON.
- **Cost tracking** (`PRICING` table) currently estimates against Lovable Gateway rates. If you use OpenAI/Gemini direct, the per-1M rates differ slightly — I'll leave a comment but won't change values unless you ask.
- **Edge function deployment**: you'll need Supabase CLI locally; Lovable was doing this for you before.

Approve and I'll implement the hybrid `chat/index.ts`, add `vercel.json`, and update the README with the exact local + Vercel + Supabase CLI steps.
