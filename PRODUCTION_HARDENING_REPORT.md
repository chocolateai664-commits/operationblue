# Production Hardening Report

Scope: stability and reliability only. No redesign, no routing change, no framework migration, no UI/UX rewrites.

## Summary of changes

| Area | Change | Files | Risk |
|---|---|---|---|
| Auth redirect | Login now lands on `/chat`, not `/` | `src/pages/Auth.tsx` | Low |
| Message persistence | `saveMessage` returns structured result, toasts on failure, callers abort flow when save fails | `src/hooks/useMessages.tsx`, `src/pages/Index.tsx` | Low |
| Quota fail-closed | `check_rolling_quota` and `increment_usage` RPC failures now return 503 instead of silently calling the LLM | `supabase/functions/chat/index.ts` | Medium (free users see explicit error if DB is degraded — intended) |
| Usage tracking loading | `loading` always resolves, including for unauthenticated users; RPC wrapped in try/finally | `src/hooks/useUsageTracking.tsx` | Low |
| Conversations errors | Differentiates permission / network / unknown; surfaces toast; exposes `error` and `errorKind` | `src/hooks/useConversations.tsx` | Low |
| Bundle size | Route-level code splitting via `React.lazy` + `Suspense` | `src/App.tsx` | Low |

## Risk assessment

- Quota fail-closed is the only user-visible behavior change for the "happy degraded" path. Previously a quota RPC error would log and continue, allowing free users to bypass limits whenever the DB hiccupped. Now those requests return 503 with a clear retry message — correct and intended.
- All other changes preserve existing happy paths; they only add user feedback on previously-silent failures.

See `BUG_FIX_SUMMARY.md`, `PERFORMANCE_REPORT.md`, `TESTING_CHECKLIST.md` for details.
