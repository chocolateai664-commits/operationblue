import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PICKER_META, PRIMARY_PICKER, SECONDARY_PICKER, type PickerModel } from "@/api/ai";
import { cn } from "@/lib/utils";

interface Props {
  value: PickerModel;
  onChange: (m: PickerModel) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const meta = PICKER_META[value];
  const renderItem = (m: PickerModel) => {
    const item = PICKER_META[m];
    return (
      <DropdownMenuItem key={m} onSelect={() => onChange(m)} className="flex items-start gap-2.5 py-2 cursor-pointer">
        {m === "auto" ? (
          <span className="text-primary text-sm leading-none mt-0.5">✦</span>
        ) : (
          <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", item.colorClass)} />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium">{item.label}</span>
          <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
        </span>
        {value === m && <Check className="w-3.5 h-3.5 text-primary mt-1" />}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-medium text-foreground hover:bg-secondary transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
        aria-label="Select model"
      >
        <span className="text-primary">✦</span>
        {meta.label}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">Select model</DropdownMenuLabel>
        {PRIMARY_PICKER.map(renderItem)}
        <DropdownMenuSeparator />
        {SECONDARY_PICKER.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
