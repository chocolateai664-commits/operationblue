import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  listingId: string;
  userId: string;
  onSigned: () => void;
}

export function NdaPanel({ listingId, userId, onSigned }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const sign = async () => {
    if (!agreed || name.trim().length < 2) {
      toast.error("Enter your full name and accept the NDA terms.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("nda_signatures").insert({
      listing_id: listingId,
      buyer_id: userId,
      full_name: name.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(`Failed to sign: ${error.message}`);
      return;
    }
    toast.success("NDA signed — private details unlocked");
    onSigned();
  };

  return (
    <Card className="border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Request Confidential Access</div>
          <div className="text-xs text-muted-foreground">
            Sign the NDA to reveal company identity and message the seller.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Full legal name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            maxLength={120}
          />
        </div>

        <label className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(Boolean(v))}
            className="mt-0.5"
          />
          <span className="text-muted-foreground">
            I agree to keep all disclosed information strictly confidential and to use it solely
            for the purpose of evaluating a potential acquisition.
          </span>
        </label>

        <Button onClick={sign} disabled={loading} className="w-full gap-2">
          <ShieldCheck className="h-4 w-4" />
          {loading ? "Signing..." : "Sign NDA & Unlock"}
        </Button>
      </div>
    </Card>
  );
}
