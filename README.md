# Operation Blue

AI workspace built on Vite + React + Supabase. Runs locally and on Vercel; Supabase remains the backend (Auth, Postgres, Edge Functions).

## Environment variables

All client-side vars MUST be prefixed `VITE_`. Provider secrets live in Supabase, never in `.env`.

| Var | Where | Required | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` + Vercel | ✅ | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` + Vercel | ✅ | Anon/publishable key (safe in browser) |
| `VITE_SUPABASE_PROJECT_ID` | `.env` + Vercel | ✅ | Used by generated client |
| `LOVABLE_API_KEY` | Supabase secrets | optional | Preferred AI provider when present |
| `OPENAI_API_KEY` | Supabase secrets | optional | Fallback for `gpt-*` models |
| `GEMINI_API_KEY` | Supabase secrets | optional | Fallback for `flash` / `gemini` |
| `STRIPE_SECRET_KEY` | Supabase secrets | ✅ for billing | |
| `SMOKE_TEST_TOKEN` | local shell | for `npm run smoke:chat` | A user JWT |

Copy `.env.example` → `.env` and fill the three `VITE_*` values. On Vercel set the same three under **Project → Settings → Environment Variables** for Production, Preview, and Development. The app will fail to boot if any are missing — Vite throws at import time and the chat edge function returns `500 Server misconfigured: SUPABASE_URL/SUPABASE_ANON_KEY not set` with a structured log line.

## Local development

```bash
bun install              # or npm install
bun run dev              # Vite on http://localhost:8080
npm run sb:start         # boot the local Supabase stack (Docker required)
npm run sb:serve         # serve the chat edge function on :54321
npm run smoke:chat       # end-to-end test (needs SMOKE_TEST_TOKEN)
```



## Deploy to Vercel

1. Import the repo into Vercel. Framework preset: **Vite**. Build: `bun run build` (or `npm run build`). Output: `dist`.
2. Add env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (copy values from `.env`).
3. `vercel.json` already provides the SPA rewrite so `/chat`, `/auth`, `/pricing` survive refreshes.

## Edge functions (Supabase CLI)

Lovable previously auto-deployed edge functions. When self-managing:

```bash
npm i -g supabase
supabase login
supabase link --project-ref iuqrxursqqqicylynxph
supabase functions deploy chat summarize check-subscription create-checkout customer-portal
```

## AI provider (hybrid)

`supabase/functions/chat/index.ts` picks a provider at runtime based on which secret is set on the Supabase project:

| Secret | Used when | Models |
|---|---|---|
| `LOVABLE_API_KEY` | Always preferred if present (current behavior) | all |
| `OPENAI_API_KEY` | Lovable key absent, or model = `gpt-5` | `gpt-5` → `gpt-4o`, others → `gpt-4o-mini` |
| `GEMINI_API_KEY` | Lovable key absent, model = `flash`/`gemini` | `flash` → `gemini-2.0-flash`, `gemini` → `gemini-2.5-pro` |

Set provider keys as Supabase secrets (never in the Vite `.env`):

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GEMINI_API_KEY=...
```

To run fully off Lovable, remove `LOVABLE_API_KEY` from Supabase secrets so the function falls back to your own keys.

## Smoke testing

`scripts/smoke-chat.mjs` runs end-to-end against any deployment:

```bash
# Local
SMOKE_TEST_TOKEN=<user-jwt> npm run smoke:chat

# Vercel / production
SMOKE_TEST_TOKEN=<user-jwt> VITE_SUPABASE_URL=https://xxx.supabase.co npm run smoke:chat
```

It asserts: (1) the function returns 401 without auth, (2) `text/event-stream` is returned with valid auth, (3) at least one `delta.content` chunk is parsed, (4) the response is non-empty — covering streaming + persistence path (messages save client-side after the stream completes; check Supabase `messages` table for the latest row).

## Structured logs

All chat function failures emit single-line JSON with `reqId`, `event`, and context — grep them in Vercel/Supabase logs:

```
event=auth_missing_header        # client sent no Bearer
event=auth_malformed_token       # JWT structure invalid
event=auth_invalid_claims        # token expired / signature bad
event=missing_env                # SUPABASE_URL or SUPABASE_ANON_KEY unset
event=quota_rpc_failed           # check_rolling_quota failed → 503
event=usage_rpc_failed           # increment_usage failed → 503
event=ai_gateway_error           # upstream provider non-2xx
event=unhandled                  # uncaught – includes stack
```

Client-side equivalents are logged via `console.error` with `scope: "stream-chat"` (stream interruptions) and `scope: "useMessages"` (persistence failures).

## Notes

- Auth, RLS, quotas (`check_rolling_quota`, `increment_usage`), conversations/messages, Stripe subscriptions — all unchanged.
- The `lovable-tagger` Vite plugin is dev-only and not included in production builds.

