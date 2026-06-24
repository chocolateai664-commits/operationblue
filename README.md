# Operation Blue

AI workspace built on Vite + React + Supabase. Runs locally and on Vercel; Supabase remains the backend (Auth, Postgres, Edge Functions).

## Local development

```bash
bun install         # or npm install
bun run dev         # Vite on http://localhost:8080
```

`.env` already contains the Supabase URL and publishable key. No other client-side env vars are required.

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

## Notes

- Auth, RLS, quotas (`check_rolling_quota`, `increment_usage`), conversations/messages, Stripe subscriptions — all unchanged.
- The `lovable-tagger` Vite plugin is dev-only and not included in production builds.
