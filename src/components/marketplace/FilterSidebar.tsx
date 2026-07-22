import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, ListingCategory } from "@/lib/marketplace";
import { RotateCcw, Search } from "lucide-react";

export interface Filters {
  q: string;
  categories: ListingCategory[];
  maxPrice: number;
  minArr: number;
  minTtm: number;
  minMargin: number;
  techQuery: string;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  categories: [],
  maxPrice: 2_000_000,
  minArr: 0,
  minTtm: 0,
  minMargin: 0,
  techQuery: "",
};

const CATS: ListingCategory[] = ["saas", "ecommerce", "mobile", "other"];

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function FilterSidebar({ filters, onChange }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  const toggleCat = (c: ListingCategory) => {
    const has = filters.categories.includes(c);
    set("categories", has ? filters.categories.filter((x) => x !== c) : [...filters.categories, c]);
  };

  return (
    <aside className="space-y-6 rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-2 py-1 text-xs"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Anonymized headlines..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Asset Type</Label>
        <div className="space-y-2">
          {CATS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.categories.includes(c)}
                onCheckedChange={() => toggleCat(c)}
              />
              {CATEGORY_LABEL[c]}
            </label>
          ))}
        </div>
      </div>

      <RangeRow
        label="Max Asking Price"
        value={filters.maxPrice}
        min={50_000}
        max={2_000_000}
        step={50_000}
        onChange={(v) => set("maxPrice", v)}
        format={(v) => `$${(v / 1000).toFixed(0)}k`}
      />
      <RangeRow
        label="Min ARR"
        value={filters.minArr}
        min={0}
        max={1_000_000}
        step={25_000}
        onChange={(v) => set("minArr", v)}
        format={(v) => `$${(v / 1000).toFixed(0)}k`}
      />
      <RangeRow
        label="Min TTM Revenue"
        value={filters.minTtm}
        min={0}
        max={2_000_000}
        step={50_000}
        onChange={(v) => set("minTtm", v)}
        format={(v) => `$${(v / 1000).toFixed(0)}k`}
      />
      <RangeRow
        label="Min Profit Margin"
        value={filters.minMargin}
        min={0}
        max={80}
        step={5}
        onChange={(v) => set("minMargin", v)}
        format={(v) => `${v}%`}
      />

      <div className="space-y-2">
        <Label className="text-xs">Tech Stack</Label>
        <Input
          value={filters.techQuery}
          onChange={(e) => set("techQuery", e.target.value)}
          placeholder="e.g. Next.js, Stripe"
        />
      </div>
    </aside>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
