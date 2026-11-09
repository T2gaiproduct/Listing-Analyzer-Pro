import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
          Shown in the seller marketplace dropdown. Saved with this skill when you publish or save draft.
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Title max chars</Label>
          <Input
            type="number"
            value={value.rules?.titleMaxChars ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                rules: {
                  ...value.rules,
                  titleMaxChars: e.target.value ? parseInt(e.target.value, 10) : undefined,
                },
              })
            }
            className="mt-1 h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Bullet count</Label>
          <Input
            type="number"
            value={value.rules?.bulletCount ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                rules: {
                  ...value.rules,
                  bulletCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                },
              })
            }
            className="mt-1 h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Keyword count</Label>
          <Input
            type="number"
            value={value.rules?.keywordCount ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                rules: {
                  ...value.rules,
                  keywordCount: e.target.value ? parseInt(e.target.value, 10) : undefined,
                },
              })
            }
            className="mt-1 h-8"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Formatting notes</Label>
        <Textarea
          value={value.rules?.formattingNotes ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              rules: { ...value.rules, formattingNotes: e.target.value || undefined },
            })
          }
          className="mt-1 min-h-[72px] text-xs"
        />
      </div>
    </div>
  );
}
