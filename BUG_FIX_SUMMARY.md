# Bug Fix Summary

## 1. Auth redirect bug

**Root cause.** `src/pages/Auth.tsx` called `navigate("/")` after a successful sign-in. `/` is the public landing page, not the chat workspace. Users had to manually navigate to `/chat`.

**Fix.** Changed to `navigate("/chat", { replace: true })`. Sign-up flow is unchanged because it requires email confirmation. Session refresh and page reload paths are handled by `ProtectedRoute` + `useAuth`, which were already correct.

**Files.** `src/pages/Auth.tsx`

**Risk.** Low. Single-line change in a leaf component.

---

## 2. Silent message-persistence failures

**Root cause.** `useMessages.saveMessage` swallowed Supabase errors (`.insert(...).select().single()` returns `{ data, error }`; the previous code only checked `data`). `Index.tsx` awaited it without inspecting the result, then pushed the message into the in-memory conversation as if it had been saved, and continued streaming the assistant response. A user could send a message, see it on screen, and lose it on reload — with no warning.

**Fix.**
- `useMessages.saveMessage` now returns `{ ok, data, error }`, logs the error, and emits a `toast.error` on failure.
- `loadMessages` surfaces fetch errors via `loadError` state and a toast.
- `Index.tsx` checks `userSave.ok` before pushing the user message into the in-memory transcript and before starting the assistant stream. If the user message can't be saved, the request is aborted.
- The assistant-message save also gates the in-memory push on `ok`.

**Files.** `src/hooks/useMessages.tsx`, `src/pages/Index.tsx`

**Risk.** Low. When persistence succeeds (the overwhelming case), behavior is unchanged.

---

## 3. Quota system fail-open behavior

**Root cause.** `supabase/functions/chat/index.ts` parsed the quota RPC error string for `QUOTA_EXCEEDED:...`. Any *other* error (RPC failure, Postgres exception, network blip, malformed result, JWT/claims edge case) was logged and execution fell through to the LLM call — i.e., quota was bypassed whenever quota validation itself failed. The `increment_usage` RPC had the same shape: only the `cost limit exceeded` substring caused a hard stop, everything else was logged and ignored.

**Fix.** Both call sites now fail closed:
- Unknown `check_rolling_quota` errors → `503 QUOTA_CHECK_FAILED` with a user-friendly retry message.
- `QUOTA_UNAUTHENTICATED` → explicit `401`.
- Unknown `increment_usage` errors → `503 USAGE_TRACKING_FAILED`.
- Known `QUOTA_EXCEEDED:5h|24h:N` and `cost limit exceeded` paths are unchanged.

**Files.** `supabase/functions/chat/index.ts`

**Risk.** Medium. If the database is degraded, free users will see explicit errors instead of getting free LLM calls. This is the correct behavior for a billing-bearing path.
