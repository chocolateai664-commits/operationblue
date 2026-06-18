# Testing Checklist

## Phase 1 — Critical bug fixes

### Auth redirect
- [ ] Sign in with valid credentials → lands on `/chat` (not `/`).
- [ ] Sign up → toast "Check your email…", stays on `/auth`.
- [ ] Reload `/chat` while signed in → stays on `/chat` after the auth spinner.
- [ ] Reload `/chat` while signed out → redirected to `/auth`.
- [ ] Sign out from `/chat` → next visit to `/chat` redirects to `/auth`.
- [ ] Visit `/auth` while signed in → redirected to `/chat`.

### Message persistence
- [ ] Send a message with the DB reachable → message appears, assistant responds, both visible after reload.
- [ ] Simulate RLS failure (e.g., temporarily revoke INSERT on `messages` in a dev project) → toast "Message not saved: …", the user message is removed from the in-memory transcript, the assistant stream does NOT start, no orphan rows.
- [ ] Open a conversation while the DB is unreachable → toast "Failed to load messages: …", `loadError` populated, UI does not silently render an empty conversation.

### Quota fail-closed (edge function)
The chat function tests below assume the test harness can call the deployed function with a valid JWT.

- [ ] Happy path under quota → 200, SSE stream returned.
- [ ] Over 5h quota → 429 `QUOTA_EXCEEDED` with `window: "5h"` and `Retry-After` header.
- [ ] Over 24h quota → 429 `QUOTA_EXCEEDED` with `window: "24h"`.
- [ ] `check_rolling_quota` raises unknown error (simulate by temporarily renaming/breaking the RPC in a dev project) → 503 `QUOTA_CHECK_FAILED`, no upstream LLM call (verify by checking `request_logs` is unchanged and no `ai.gateway.lovable.dev` call in function logs).
- [ ] `increment_usage` raises unknown error → 503 `USAGE_TRACKING_FAILED`, no LLM call.
- [ ] Missing/invalid bearer token → 401 `Unauthorized`.

Suggested Deno test scaffold (run with `lovable-exec test` against a dev project):

```ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/chat`;
const KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("rejects unauthenticated", async () => {
  const r = await fetch(URL, { method: "POST", body: "{}" });
  assertEquals(r.status, 401);
  await r.text();
});

Deno.test("rejects malformed bearer", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer not-a-jwt", "Content-Type": "application/json", apikey: KEY },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], model: "flash" }),
  });
  assertEquals(r.status, 401);
  await r.text();
});
```

Fail-closed cases for `check_rolling_quota` / `increment_usage` are best validated by temporarily renaming the function in a dev project and asserting `503`.

## Phase 2 — Reliability

### useUsageTracking
- [ ] Sign out → `loading` becomes `false` within one tick; UI does not stick on a spinner.
- [ ] Sign in → `loading` resolves to `false` after `get_rolling_usage` returns (success or error).
- [ ] Simulate `get_rolling_usage` error → no unhandled rejection, `loading` still resolves.

### useConversations
- [ ] Logged-out → empty list, no error, no toast.
- [ ] Logged-in happy path → list loads, no toast.
- [ ] Permission error (simulate RLS denial) → toast "You don't have access…", `errorKind === "permission"`.
- [ ] Network failure (offline) → toast "Network issue…", `errorKind === "network"`.

## Phase 3 — Performance
- [ ] `bun run build` succeeds.
- [ ] Build output shows separate chunks for `Index`, `Landing`, `Auth`, `Pricing`, `NotFound`.
- [ ] Entry chunk gzipped size dropped vs. previous build.
- [ ] `/` (Landing) loads without fetching the chat chunk (verify in Network panel).
- [ ] Navigating `/` → `/chat` triggers a chat-chunk request and renders the workspace.
