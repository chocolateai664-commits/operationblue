import { Badge } from "@/components/ui/badge";

export function TechStackTokens({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <Badge key={t} variant="outline" className="font-mono text-[11px] font-normal">
          {t}
        </Badge>
      ))}
    </div>
  );
}
