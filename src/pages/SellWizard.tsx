import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABEL, ListingCategory } from "@/lib/marketplace";

interface FormState {
  headline: string;
  category: ListingCategory;
  techInput: string;
  tech_stack: string[];
  asking_price: string;
  ttm_revenue: string;
  ttm_profit: string;
  arr: string;
  description: string;
  reason_for_selling: string;
  growth_opportunities: string;
}

const INITIAL: FormState = {
  headline: "",
  category: "saas",
  techInput: "",
  tech_stack: [],
  asking_price: "",
  ttm_revenue: "",
  ttm_profit: "",
  arr: "",
  description: "",
  reason_for_selling: "",
  growth_opportunities: "",
};

export default function SellWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const addTech = () => {
    const v = f.techInput.trim();
    if (!v || f.tech_stack.includes(v)) return;
    setF((p) => ({ ...p, tech_stack: [...p.tech_stack, v], techInput: "" }));
  };
  const removeTech = (t: string) =>
    setF((p) => ({ ...p, tech_stack: p.tech_stack.filter((x) => x !== t) }));

  const canNext =
    (step === 1 && f.headline.trim().length > 3 && f.tech_stack.length > 0) ||
    (step === 2 && Number(f.asking_price) > 0 && Number(f.ttm_revenue) >= 0) ||
    step === 3;

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const price = Number(f.asking_price);
    const rev = Number(f.ttm_revenue);
    const profit = Number(f.ttm_profit);
    const arr = Number(f.arr);
    const slug = `${f.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)}-${Date.now().toString(36).slice(-5)}`;

    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: user.id,
        slug,
        headline: f.headline.trim(),
        category: f.category,
        tech_stack: f.tech_stack,
        asking_price: price,
        ttm_revenue: rev,
        ttm_profit: profit,
        arr,
        mrr: Math.round(arr / 12),
        profit_margin: rev > 0 ? Number((profit / rev).toFixed(2)) : 0,
        description: f.description.trim(),
        reason_for_selling: f.reason_for_selling.trim(),
        growth_opportunities: f.growth_opportunities.trim(),
        status: "draft",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(`Could not save: ${error?.message ?? "unknown"}`);
      return;
    }
    toast.success("Draft listing saved");
    navigate(`/marketplace/${data.id}`);
  };

  const pct = (step / 3) * 100;

  return (
    <div className="min-h-screen-safe bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/marketplace">
              <ArrowLeft className="h-4 w-4" />
              Marketplace
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">Step {step} of 3</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">List your startup</h1>
          <p className="text-sm text-muted-foreground">
            Share anonymized details. Company identity stays hidden until an NDA is signed.
          </p>
          <Progress value={pct} className="h-1.5" />
        </div>

        <Card className="border-border/60 p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Basics
              </h2>
              <div className="space-y-1.5">
                <Label>Anonymized headline</Label>
                <Input
                  value={f.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="e.g. AI Copywriting Tool for E-commerce"
                  maxLength={140}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asset type</Label>
                <Select value={f.category} onValueChange={(v: ListingCategory) => set("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABEL) as ListingCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tech stack</Label>
                <div className="flex gap-2">
                  <Input
                    value={f.techInput}
                    onChange={(e) => set("techInput", e.target.value)}
                    placeholder="Add tech and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTech();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTech}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {f.tech_stack.map((t) => (
                    <Badge key={t} variant="outline" className="gap-1 font-mono text-[11px]">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTech(t)}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Financials
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <MoneyInput label="Asking price" value={f.asking_price} onChange={(v) => set("asking_price", v)} />
                <MoneyInput label="ARR" value={f.arr} onChange={(v) => set("arr", v)} />
                <MoneyInput label="TTM Revenue" value={f.ttm_revenue} onChange={(v) => set("ttm_revenue", v)} />
                <MoneyInput label="TTM Profit" value={f.ttm_profit} onChange={(v) => set("ttm_profit", v)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Profit margin is calculated automatically from TTM revenue and profit.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Story & assets
              </h2>
              <div className="space-y-1.5">
                <Label>Business description</Label>
                <Textarea
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  maxLength={1500}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Growth opportunities</Label>
                  <Textarea
                    value={f.growth_opportunities}
                    onChange={(e) => set("growth_opportunities", e.target.value)}
                    rows={3}
                    maxLength={800}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason for selling</Label>
                  <Textarea
                    value={f.reason_for_selling}
                    onChange={(e) => set("reason_for_selling", e.target.value)}
                    rows={3}
                    maxLength={800}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <UploadStub label="Pitch deck (PDF)" />
                <UploadStub label="Product screenshots" />
              </div>
              <p className="text-xs text-muted-foreground">
                Uploads are placeholders in this preview; the draft still saves to your listings.
              </p>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="gap-1">
              <Check className="h-4 w-4" />
              {submitting ? "Saving..." : "Save draft"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="pl-6 font-mono tabular-nums"
          placeholder="0"
        />
      </div>
    </div>
  );
}

function UploadStub({ label }: { label: string }) {
  return (
    <label className="flex cursor-not-allowed items-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
      <Upload className="h-4 w-4" />
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs">Uploads enabled after publish (coming soon)</div>
      </div>
    </label>
  );
}
