

## Plan: AI Cost Control, File Chunking, Server-Side Limits, and Admin Role

This plan implements the system described in the uploaded document, adapted to the existing architecture (Lovable Cloud edge functions, existing usage tracking, and Supabase auth).

### 1. Token Estimation and Cost Tracking Utility

Create `src/utils/cost.ts` with:
- `estimateTokens(text)` — approximate tokens via `text.length / 4`
- `calculateCost(model, inputTokens, outputTokens)` — returns cost in USD using a pricing map
- Pricing map covering the existing models (flash, gemini, gpt-5, ollama)

### 2. File Chunking and Summarization

Create `src/utils/chunk.ts`:
- `chunkText(text, size = 2000): string[]` — splits text into chunks

Create `supabase/functions/summarize/index.ts` (edge function):
- Accepts chunks array, calls Lovable AI gateway with a cheap model (gemini-2.5-flash-lite) to summarize each chunk
- Returns combined summary string
- Authenticates the user and checks limits before processing

Update `src/components/chat/ChatInput.tsx`:
- Instead of raw file content injection, send file content through the summarization pipeline before attaching to message
- Add a loading state while summarization runs

### 3. Server-Side Usage Limit Enforcement

**Database migration** — alter `usage_tracking` table:
- Add columns: `monthly_cost NUMERIC DEFAULT 0`, `monthly_tokens INTEGER DEFAULT 0`, `role TEXT DEFAULT 'user'`
- Wait — per the user-roles instructions, roles MUST be in a separate table. Create `user_roles` table with `app_role` enum (`user`, `pro`, `admin`).

**Create `user_roles` table and enum** (migration):
```sql
CREATE TYPE public.app_role AS ENUM ('user', 'pro', 'admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) ...
```

**Add cost tracking columns to `usage_tracking`** (migration):
```sql
ALTER TABLE usage_tracking
  ADD COLUMN monthly_cost NUMERIC DEFAULT 0,
  ADD COLUMN monthly_tokens INTEGER DEFAULT 0,
  ADD COLUMN cost_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now());
```

**Update `increment_usage` function** to also accept and track tokens + cost, enforce limits:
- Free: reject if `monthly_cost > 0.50`
- Pro: reject if `monthly_cost > 7.00`
- Admin (via `has_role`): no limit, still tracked

**Update `supabase/functions/chat/index.ts`**:
- Authenticate user from JWT
- Call a new DB function `check_and_increment_usage(estimated_input_tokens, model)` that checks limits before proceeding
- After response, estimate output tokens and update cost via another RPC
- Log model, tokens, cost per request

### 4. Admin Role Support

- Use `user_roles` table (per security guidelines)
- Admin bypasses cost limits but usage is still tracked
- No client-side admin check — all enforcement in edge function + DB function

### 5. Performance and Safety Constraints

Add constants to the chat edge function:
- `MAX_INPUT_TOKENS = 8000`
- `MAX_OUTPUT_TOKENS = 800` (pass to AI gateway)
- Reject requests exceeding max input before calling AI

### 6. Request Logging

Add a `request_logs` table (migration):
```sql
CREATE TABLE public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
With RLS: users can SELECT own logs only. Insert handled by security definer function.

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/utils/cost.ts` | Create — token estimation + cost calculation |
| `src/utils/chunk.ts` | Create — text chunking utility |
| `supabase/functions/summarize/index.ts` | Create — chunk summarization edge function |
| `supabase/functions/chat/index.ts` | Edit — add auth, limit checks, token/cost tracking, max output tokens |
| `src/hooks/useUsageTracking.tsx` | Edit — expose monthly cost, role info |
| `src/components/chat/ChatInput.tsx` | Edit — summarize file content before attaching |
| `src/api/ai.ts` | Edit — pass token estimates through |
| Migration files | Create — user_roles table, usage_tracking columns, request_logs table, updated DB functions |

### Non-Goals (per document)
- No PDF/DOC parsing, ZIP extraction, vector DB, embeddings, or RAG

