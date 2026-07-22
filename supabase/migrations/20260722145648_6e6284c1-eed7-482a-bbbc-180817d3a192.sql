
-- Enum for listing category & status
DO $$ BEGIN
  CREATE TYPE public.listing_category AS ENUM ('saas','ecommerce','mobile','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.listing_status AS ENUM ('draft','active','sold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LISTINGS
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid,
  slug text UNIQUE NOT NULL,
  category public.listing_category NOT NULL DEFAULT 'saas',
  headline text NOT NULL,
  description text NOT NULL DEFAULT '',
  tech_stack text[] NOT NULL DEFAULT '{}',
  asking_price numeric NOT NULL DEFAULT 0,
  ttm_revenue numeric NOT NULL DEFAULT 0,
  ttm_profit numeric NOT NULL DEFAULT 0,
  arr numeric NOT NULL DEFAULT 0,
  mrr numeric NOT NULL DEFAULT 0,
  profit_margin numeric NOT NULL DEFAULT 0,
  ltv numeric NOT NULL DEFAULT 0,
  cac numeric NOT NULL DEFAULT 0,
  assets_included text[] NOT NULL DEFAULT '{}',
  financing_available boolean NOT NULL DEFAULT false,
  reason_for_selling text NOT NULL DEFAULT '',
  growth_opportunities text NOT NULL DEFAULT '',
  badges text[] NOT NULL DEFAULT '{}',
  monthly_stats jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.listing_status NOT NULL DEFAULT 'draft',
  -- locked
  company_name text,
  company_url text,
  stripe_account_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active listings viewable by authenticated"
  ON public.listings FOR SELECT TO authenticated
  USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Sellers insert own listings"
  ON public.listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers update own listings"
  ON public.listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers delete own listings"
  ON public.listings FOR DELETE TO authenticated
  USING (seller_id = auth.uid());

-- NDA SIGNATURES
CREATE TABLE IF NOT EXISTS public.nda_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  full_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);

GRANT SELECT, INSERT, DELETE ON public.nda_signatures TO authenticated;
GRANT ALL ON public.nda_signatures TO service_role;
ALTER TABLE public.nda_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer manages own NDA"
  ON public.nda_signatures FOR ALL TO authenticated
  USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Seller can read NDAs for own listings"
  ON public.nda_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = nda_signatures.listing_id AND l.seller_id = auth.uid()));

-- LISTING MESSAGES
CREATE TABLE IF NOT EXISTS public.listing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.listing_messages TO authenticated;
GRANT ALL ON public.listing_messages TO service_role;
ALTER TABLE public.listing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages"
  ON public.listing_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Send message requires NDA or seller"
  ON public.listing_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.nda_signatures n WHERE n.listing_id = listing_messages.listing_id AND n.buyer_id = auth.uid())
    )
  );

-- Private info RPC
CREATE OR REPLACE FUNCTION public.get_listing_private(_listing_id uuid)
RETURNS TABLE (company_name text, company_url text, stripe_account_ref text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.listings l WHERE l.id = _listing_id AND l.seller_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.nda_signatures n WHERE n.listing_id = _listing_id AND n.buyer_id = auth.uid())
  THEN
    RETURN QUERY SELECT l.company_name, l.company_url, l.stripe_account_ref
      FROM public.listings l WHERE l.id = _listing_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_listing_private(uuid) TO authenticated;

-- updated_at trigger
CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED 8 mock listings
INSERT INTO public.listings
  (slug, category, headline, description, tech_stack, asking_price, ttm_revenue, ttm_profit, arr, mrr, profit_margin, ltv, cac, assets_included, financing_available, reason_for_selling, growth_opportunities, badges, monthly_stats, status, company_name, company_url)
VALUES
('ai-copywriting-saas','saas','AI Copywriting Tool for E-commerce',
 'Profitable AI SaaS generating on-brand product descriptions for Shopify merchants. 2.4k paid users, 3.1% monthly churn.',
 ARRAY['Next.js','Supabase','OpenAI','Stripe'],
 480000, 312000, 189000, 348000, 29000, 0.61, 640, 78,
 ARRAY['Codebase','Domain','Customer list','Stripe subscriptions','SOPs'],
 true,'Founder pursuing new venture','Add team plans; expand to Amazon listings; SEO content engine',
 ARRAY['vetted','profitable','stripe_verified'],
 '[{"m":"2025-01","rev":22000,"exp":9500},{"m":"2025-02","rev":23500,"exp":9800},{"m":"2025-03","rev":24800,"exp":10200},{"m":"2025-04","rev":25600,"exp":10400},{"m":"2025-05","rev":26200,"exp":10600},{"m":"2025-06","rev":27100,"exp":10900},{"m":"2025-07","rev":27800,"exp":11100},{"m":"2025-08","rev":28400,"exp":11300},{"m":"2025-09","rev":28900,"exp":11500},{"m":"2025-10","rev":29200,"exp":11700},{"m":"2025-11","rev":29500,"exp":11900},{"m":"2025-12","rev":29000,"exp":12100}]'::jsonb,
 'active','Kopyra Labs Inc.','https://kopyra.example.com'),

('dtc-skincare-brand','ecommerce','DTC Skincare Brand (Clean Beauty)',
 'Premium clean-beauty DTC brand with 38% repeat purchase rate. Shopify + Klaviyo, 92k email list.',
 ARRAY['Shopify','Klaviyo','Meta Ads','TikTok'],
 1250000, 1840000, 412000, 0, 0, 0.22, 210, 46,
 ARRAY['Shopify store','Inventory','Supplier contracts','Email list','Social handles'],
 true,'Team ready for next chapter','Wholesale channel; retail placement; international shipping',
 ARRAY['vetted','profitable'],
 '[{"m":"2025-01","rev":128000,"exp":102000},{"m":"2025-02","rev":132000,"exp":104000},{"m":"2025-03","rev":149000,"exp":118000},{"m":"2025-04","rev":152000,"exp":121000},{"m":"2025-05","rev":161000,"exp":126000},{"m":"2025-06","rev":155000,"exp":122000},{"m":"2025-07","rev":158000,"exp":124000},{"m":"2025-08","rev":164000,"exp":128000},{"m":"2025-09","rev":171000,"exp":133000},{"m":"2025-10","rev":178000,"exp":139000},{"m":"2025-11","rev":192000,"exp":150000},{"m":"2025-12","rev":205000,"exp":160000}]'::jsonb,
 'active','Lumen Glow Co.','https://lumenglow.example.com'),

('habit-tracker-ios','mobile','Habit Tracker iOS App',
 'Top 100 Health & Fitness app. 74k MAU, freemium with 4.6% conversion. Swift + StoreKit 2.',
 ARRAY['Swift','SwiftUI','Firebase','RevenueCat'],
 220000, 148000, 96000, 168000, 14000, 0.65, 82, 11,
 ARRAY['App Store listing','Codebase','RevenueCat account','Analytics'],
 false,'Founder returning to full-time role','Android port; Apple Watch complications; team/coach tier',
 ARRAY['profitable','stripe_verified'],
 '[{"m":"2025-01","rev":10500,"exp":3400},{"m":"2025-02","rev":11200,"exp":3600},{"m":"2025-03","rev":11800,"exp":3700},{"m":"2025-04","rev":12100,"exp":3800},{"m":"2025-05","rev":12500,"exp":3900},{"m":"2025-06","rev":12900,"exp":4000},{"m":"2025-07","rev":13100,"exp":4050},{"m":"2025-08","rev":13400,"exp":4100},{"m":"2025-09","rev":13600,"exp":4150},{"m":"2025-10","rev":13800,"exp":4200},{"m":"2025-11","rev":13900,"exp":4250},{"m":"2025-12","rev":14200,"exp":4300}]'::jsonb,
 'active','Streaky App LLC','https://streakyapp.example.com'),

('devtool-observability','saas','Developer Observability SaaS',
 'Log analytics for indie SaaS teams. 210 paid workspaces. Postgres + ClickHouse pipeline.',
 ARRAY['Node.js','ClickHouse','Postgres','React'],
 890000, 520000, 210000, 588000, 49000, 0.40, 2100, 340,
 ARRAY['Codebase','Infra IaC','Customer list','Domain'],
 true,'Acquisition preferred over Series A','Enterprise SSO; APM module; ClickHouse Cloud partnership',
 ARRAY['vetted','stripe_verified'],
 '[{"m":"2025-01","rev":38000,"exp":22000},{"m":"2025-02","rev":40000,"exp":23000},{"m":"2025-03","rev":42000,"exp":23500},{"m":"2025-04","rev":43500,"exp":24000},{"m":"2025-05","rev":45000,"exp":24500},{"m":"2025-06","rev":46000,"exp":25000},{"m":"2025-07","rev":47000,"exp":25500},{"m":"2025-08","rev":48000,"exp":26000},{"m":"2025-09","rev":48500,"exp":26500},{"m":"2025-10","rev":49000,"exp":27000},{"m":"2025-11","rev":49500,"exp":27500},{"m":"2025-12","rev":50000,"exp":28000}]'::jsonb,
 'active','Loggr Systems','https://loggr.example.com'),

('newsletter-crm','saas','Newsletter CRM for Creators',
 'ConvertKit-alternative focused on paid newsletters. 1.1k subscribers, deep Stripe integration.',
 ARRAY['Rails','Postgres','Stripe','Tailwind'],
 340000, 216000, 128000, 240000, 20000, 0.59, 480, 62,
 ARRAY['Codebase','Customers','Domain','Templates'],
 false,'Pursuing academic program','Referral program; AI writing assistant; podcast bundling',
 ARRAY['profitable','stripe_verified'],
 '[{"m":"2025-01","rev":15500,"exp":6100},{"m":"2025-02","rev":16200,"exp":6300},{"m":"2025-03","rev":17000,"exp":6500},{"m":"2025-04","rev":17600,"exp":6700},{"m":"2025-05","rev":18100,"exp":6900},{"m":"2025-06","rev":18500,"exp":7100},{"m":"2025-07","rev":18800,"exp":7200},{"m":"2025-08","rev":19100,"exp":7300},{"m":"2025-09","rev":19400,"exp":7400},{"m":"2025-10","rev":19600,"exp":7500},{"m":"2025-11","rev":19800,"exp":7600},{"m":"2025-12","rev":20000,"exp":7700}]'::jsonb,
 'active','Quilltide','https://quilltide.example.com'),

('pet-accessories-store','ecommerce','Pet Accessories Store (Amazon FBA)',
 'Amazon FBA brand in the pet accessories niche. 12 SKUs, 4.7★ average, $6.2 avg AOV margin.',
 ARRAY['Amazon FBA','Helium10','QuickBooks'],
 410000, 620000, 156000, 0, 0, 0.25, 38, 9,
 ARRAY['Amazon Seller Central','Trademark','Supplier contacts','Product photography'],
 true,'Diversifying portfolio','Shopify DTC channel; subscription boxes; EU marketplaces',
 ARRAY['vetted','profitable'],
 '[{"m":"2025-01","rev":42000,"exp":32000},{"m":"2025-02","rev":45000,"exp":34000},{"m":"2025-03","rev":48000,"exp":36000},{"m":"2025-04","rev":50000,"exp":37500},{"m":"2025-05","rev":52000,"exp":39000},{"m":"2025-06","rev":54000,"exp":40500},{"m":"2025-07","rev":56000,"exp":42000},{"m":"2025-08","rev":57000,"exp":43000},{"m":"2025-09","rev":58000,"exp":43500},{"m":"2025-10","rev":59000,"exp":44000},{"m":"2025-11","rev":63000,"exp":47000},{"m":"2025-12","rev":66000,"exp":49000}]'::jsonb,
 'active','Pawtono','https://pawtono.example.com'),

('meditation-android','mobile','Meditation & Sleep Android App',
 'Guided meditation + sleep sounds. 210k installs, 32k MAU, Play Store 4.8★.',
 ARRAY['Kotlin','Jetpack Compose','Firebase','RevenueCat'],
 175000, 96000, 51000, 108000, 9000, 0.53, 55, 14,
 ARRAY['Play Store listing','Audio library licenses','Codebase'],
 false,'Founder relocating','iOS port; corporate wellness B2B; Wear OS',
 ARRAY['profitable'],
 '[{"m":"2025-01","rev":6800,"exp":3100},{"m":"2025-02","rev":7000,"exp":3200},{"m":"2025-03","rev":7300,"exp":3300},{"m":"2025-04","rev":7500,"exp":3400},{"m":"2025-05","rev":7700,"exp":3500},{"m":"2025-06","rev":7900,"exp":3600},{"m":"2025-07","rev":8100,"exp":3700},{"m":"2025-08","rev":8300,"exp":3800},{"m":"2025-09","rev":8500,"exp":3900},{"m":"2025-10","rev":8700,"exp":4000},{"m":"2025-11","rev":8900,"exp":4100},{"m":"2025-12","rev":9200,"exp":4200}]'::jsonb,
 'active','Nightbloom','https://nightbloom.example.com'),

('b2b-scheduling-saas','saas','B2B Scheduling SaaS (Calendly alternative)',
 'Team scheduling with Google/MS Graph integrations. 640 paid teams, 1.8% churn.',
 ARRAY['Go','React','Postgres','Kubernetes'],
 1400000, 780000, 340000, 900000, 75000, 0.44, 3200, 480,
 ARRAY['Codebase','Infra','Customers','Domain','SOC2 report'],
 true,'Strategic acquirer preferred','SSO enterprise; AI scheduling assistant; Salesforce app',
 ARRAY['vetted','profitable','stripe_verified'],
 '[{"m":"2025-01","rev":58000,"exp":34000},{"m":"2025-02","rev":60000,"exp":35000},{"m":"2025-03","rev":62000,"exp":36000},{"m":"2025-04","rev":64000,"exp":37000},{"m":"2025-05","rev":65000,"exp":37500},{"m":"2025-06","rev":66000,"exp":38000},{"m":"2025-07","rev":67000,"exp":38500},{"m":"2025-08","rev":68000,"exp":39000},{"m":"2025-09","rev":69000,"exp":39500},{"m":"2025-10","rev":70000,"exp":40000},{"m":"2025-11","rev":71000,"exp":40500},{"m":"2025-12","rev":72000,"exp":41000}]'::jsonb,
 'active','Tempora Cal','https://temporacal.example.com')
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_nda_buyer ON public.nda_signatures(buyer_id);
CREATE INDEX IF NOT EXISTS idx_msg_listing ON public.listing_messages(listing_id, created_at);
