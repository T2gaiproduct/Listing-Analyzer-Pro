import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ContentMarketplaceAdmin } from "@/lib/content-marketplaces";

type AdminMarketplaceSkillSettingsProps = {
  value: ContentMarketplaceAdmin;
  onChange: (next: ContentMarketplaceAdmin) => void;
};

export function AdminMarketplaceSkillSettings({
  value,
  onChange,
}: AdminMarketplaceSkillSettingsProps) {
  return (
    <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50/40 p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold">Marketplace settings</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Seller dropdown only. Title limits, bullets, and tone live in the skill instructions below — not here.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Display name</Label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Slug</Label>
          <Input value={value.slug} disabled className="mt-1 font-mono text-xs" />
        </div>
        <div>
          <Label className="text-xs">Sort order</Label>
          <Input
            type="number"
            value={value.sortOrder}
            onChange={(e) =>
              onChange({ ...value, sortOrder: parseInt(e.target.value, 10) || 0 })
            }
            className="mt-1"
          />
        </div>
        <div className="flex items-end gap-6 pb-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={value.isDefault}
              onCheckedChange={(v) => onChange({ ...value, isDefault: v })}
            />
            <Label className="text-xs">Default marketplace</Label>
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description (shown to sellers)</Label>
        <Input
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          className="mt-1"
        />
      </div>
    </div>
  );
}
