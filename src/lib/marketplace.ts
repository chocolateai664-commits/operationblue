export type ListingCategory = "saas" | "ecommerce" | "mobile" | "other";
export type ListingStatus = "draft" | "active" | "sold";

export interface MonthlyStat {
  m: string;
  rev: number;
  exp: number;
}

export interface Listing {
  id: string;
  slug: string;
  seller_id: string | null;
  category: ListingCategory;
  headline: string;
  description: string;
  tech_stack: string[];
  asking_price: number;
  ttm_revenue: number;
  ttm_profit: number;
  arr: number;
  mrr: number;
  profit_margin: number;
  ltv: number;
  cac: number;
  assets_included: string[];
  financing_available: boolean;
  reason_for_selling: string;
  growth_opportunities: string;
  badges: string[];
  monthly_stats: MonthlyStat[];
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABEL: Record<ListingCategory, string> = {
  saas: "SaaS",
  ecommerce: "E-commerce",
  mobile: "Mobile App",
  other: "Other",
};

export const BADGE_LABEL: Record<string, string> = {
  vetted: "Vetted Metrics",
  profitable: "Profitable",
  stripe_verified: "Stripe Verified",
};

export function formatUSD(n: number, compact = true): string {
  if (!Number.isFinite(n)) return "$0";
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
