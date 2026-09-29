import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";

type Props = {
  marketplaces: ContentMarketplaceOption[];
  value?: number;
  onChange: (id: number) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function ContentMarketplaceSelect({
  marketplaces,
  value,
  onChange,
  loading,
  disabled,
  className,
}: Props) {
  const selected = marketplaces.find((m) => m.id === value);

  return (
    <div className={className}>
      <Label className="text-xs font-medium text-foreground mb-1.5 block">Marketplace</Label>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading marketplaces…
        </div>
      ) : (
        <Select
          value={value != null ? String(value) : undefined}
          onValueChange={(v) => onChange(parseInt(v, 10))}
          disabled={disabled || marketplaces.length === 0}
        >
          <SelectTrigger className="h-9 rounded-xl text-sm">
            <SelectValue placeholder="Select marketplace" />
          </SelectTrigger>
          <SelectContent>
            {marketplaces.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selected?.description ? (
        <p className="text-[11px] text-muted-foreground mt-1.5">{selected.description}</p>
      ) : null}
    </div>
  );
}
