

## Plan: Pricing Page, Customer Portal, and Testing Prep

### 1. Create Pricing Page (`src/pages/Pricing.tsx`)
- Full-page Free vs Pro comparison with feature list
- Free tier: 5 AI requests, Ollama only, basic chat history
- Pro tier ($9.99/mo): Unlimited requests, all models (Ollama + OpenAI + Gemini), full history, priority support
- Upgrade button calls `create-checkout` edge function
- Pro users see "Manage Subscription" button instead

### 2. Create Customer Portal Edge Function (`supabase/functions/customer-portal/index.ts`)
- Authenticates user, looks up Stripe customer by email
- Creates a Stripe billing portal session
- Returns portal URL for redirect

### 3. Add Navigation to Pricing
- Add a "Pricing" or crown/zap icon button in the Index header bar
- Add route `/pricing` in `App.tsx`
- Link from `UpgradePrompt` component to pricing page

### 4. Update Sidebar with Subscription Status
- Show Pro badge or "Manage Subscription" link in sidebar for Pro users
- Button invokes `customer-portal` function and opens portal in new tab

### 5. Files to Create/Edit
- **Create**: `src/pages/Pricing.tsx` — tier comparison page
- **Create**: `supabase/functions/customer-portal/index.ts` — Stripe portal function  
- **Edit**: `src/App.tsx` — add `/pricing` route
- **Edit**: `src/pages/Index.tsx` — add pricing link in header
- **Edit**: `src/components/chat/UpgradePrompt.tsx` — link to pricing page
- **Edit**: `src/components/chat/ChatSidebar.tsx` — add manage subscription button for Pro users

### Technical Details
- Customer portal function uses `stripe.billingPortal.sessions.create()` with the customer ID
- Pricing page reads `isPro` from `useUsageTracking` to conditionally show "Current Plan" vs "Upgrade" 
- No webhooks needed — existing polling via `check-subscription` handles status sync
- Note on leaked password protection: this is an auth setting the user can enable in Cloud → Auth Settings; no code change needed

