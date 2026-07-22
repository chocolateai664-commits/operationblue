# Marketplace Build Plan

Add an Acquire.com-inspired marketplace layer to the existing app without disturbing the current chat/discover product. All new routes live under `/marketplace` and `/sell`.

## 1. Data (Supabase migration)

New tables in `public`, all with RLS + explicit GRANTs:

- **listings** — public-safe metadata + private locked fields.
  - Public: `id`, `slug`, `category` (saas|ecommerce|mobile|other), `headline` (anonymized, e.g. "AI Copywriting SaaS"), `description`, `tech_stack text[]`, `asking_price`, `ttm_revenue`, `ttm_profit`, `arr`, `mrr`, `profit_margin`, `ltv`, `cac`, `assets_included text[]`, `financing_available bool`, `reason_for_selling`, `growth_opportunities`, `badges text[]` (vetted, profitable, stripe_verified), `monthly_stats jsonb` (12mo revenue/expense series), `seller_id uuid`, `status` (draft|active|sold), timestamps.
  - Locked: `company_name`, `company_url`, `stripe_account_ref` — only readable to seller or NDA-signed buyers (enforced via a view/RPC).
- **nda_signatures** — `id`, `listing_id`, `buyer_id`, `signed_at`, `full_name`.
- **listing_messages** — `id`, `listing_id`, `sender_id`, `recipient_id`, `body`, `created_at`. Requires signed NDA to insert.

**RLS**

- `listings`: anyone authenticated can `SELECT` active listings; sellers manage their own drafts.
- `nda_signatures`: buyer manages own rows; seller can read rows for their listings.
- `listing_messages`: insert allowed only if buyer has a matching `nda_signatures` row (or is the seller); select limited to sender/recipient.
- Locked fields: expose via `get_listing_private(listing_id)` security-definer RPC that returns company_name/url only when NDA signed or requester is the seller.

**Seed** — insert ~8 realistic mock listings covering SaaS / e-commerce / mobile with varied prices, margins, and 12-month series so the explorer looks alive out of the box.

## 2. Routing (`src/App.tsx`)

Add lazy routes:

- `/marketplace` → `Marketplace.tsx` (protected)
- `/marketplace/:id` → `ListingDetail.tsx` (protected)
- `/sell` → `SellWizard.tsx` (protected)

Add a "Marketplace" link to the existing left sidebar / nav.

## 3. Pages & components

- `**pages/Marketplace.tsx**` — 12-col layout: left `FilterSidebar` (price range, ARR, TTM revenue, profit margin, asset type checkboxes, tech-stack multi-select, search box) + right dense grid of `ListingCard`s. Cards show category + anonymized headline, key metrics (ARR / TTM / margin), badge chips, and a "Request Access (NDA)" CTA that deep-links to the detail page. Client-side filtering over fetched active listings.
- `**pages/ListingDetail.tsx**` — Header with headline, badges, asking price, and NDA state. Tabs (`shadcn/ui`):
  - Overview — description, growth opportunities, reason for selling, tech-stack tokens.
  - Financials — Recharts `ComposedChart` (revenue bars + expense line, 12mo) plus metric callout cards for ARR, Net Profit, LTV, CAC.
  - Acquisition Terms — asking price, financing options, assets included list.
  - Right rail: `NdaPanel` (checkbox + typed full-name + Sign button → inserts `nda_signatures`). Once signed, panel swaps to `MessageComposer` with a pre-filled prompt and thread of `listing_messages`. Locked fields render as "Locked — NDA Required" placeholders until the RPC returns real data.
- `**pages/SellWizard.tsx**` — 3-step wizard using local state + `Progress`:
  1. Basics (title, category, tech stack chips).
  2. Financials (asking price, TTM revenue, TTM profit, ARR).
  3. Description + placeholder file inputs for pitch deck / screenshots (no upload wiring yet).
  Final submit inserts a `listings` row with `status='draft'` owned by `auth.uid()`.
- **Shared components** under `src/components/marketplace/`: `ListingCard`, `FilterSidebar`, `MetricCallout`, `NdaPanel`, `MessageComposer`, `TechStackTokens`, `BadgeRow`.

## 4. Design system

Reuse existing tokens (already slate/indigo-friendly). Add a couple of scoped utility classes for the marketplace surfaces (subtle card borders, monospaced numerics for financial figures via `font-mono tabular-nums`) inside component files — no global palette rewrite. Full dark-mode parity via existing HSL tokens.

## 5. Out of scope (call out to user)

- Real file uploads (pitch deck / screenshots) — placeholders only.
- Payments/escrow.
- Email notifications for new messages.
- Admin verification workflow for the "Vetted" badge (badges come from seed data / seller-supplied for now).

## Technical notes

- Use `@/integrations/supabase/client` for all data access.
- Recharts is already a common dep in this stack; if missing, add via `bun add recharts`.
- All new tables get `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`, no `anon` grants.
- Locked-field RPC pattern avoids leaking company identity through PostgREST column selection.

Let's build out the full [Acquire.com](http://Acquire.com)-inspired marketplace according to the outlined plan. Please execute the steps in order:

1. Database Schema & RLS: Create the `listings`, `nda_signatures`, and `listing_messages` tables with the specified columns and RLS rules. Implement the `get_listing_private` security-definer RPC function. Seed the database with 8 highly realistic mock startups across SaaS, mobile, and e-commerce (include realistic 12-month financial arrays for the charts). Ensure proper explicit grants for `authenticated` and `service_role`.

2. Navigation & Router: Register the lazy-loaded routes for `/marketplace`, `/marketplace/:id`, and `/sell` in `src/App.tsx`. Wire a clean "Marketplace" nav item into the existing left sidebar layout using the existing design tokens.

3. Frontend Components & Views:

   - Build `pages/Marketplace.tsx` featuring the 12-column layout, multi-variable `FilterSidebar`, and a tight data-dense grid of `ListingCard` components.

   - Build `pages/ListingDetail.tsx` implementing the full UI split layout: the interactive Recharts financial charts inside the tab panels, and the conditional `NdaPanel` / `MessageComposer` workflow on the right rail.

   - Build `pages/SellWizard.tsx` with the clean 3-step form wizard tracking intermediate local state and updating the `Progress` bar before writing the final draft to Supabase.

Please implement all logic natively with the `@/integrations/supabase/client` library. Keep layout tweaks scoped locally within the components using Tailwind, and ensure strict dark mode parity matching the app's existing theme tokens.