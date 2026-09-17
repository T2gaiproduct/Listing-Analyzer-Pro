import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HELP_CMS_DEFAULTS,
  MAX_HELP_ARTICLES_PER_CATEGORY,
  MAX_HELP_CATEGORIES,
  helpArticleKeys,
  helpCategoryKeys,
  type HelpCmsMap,
} from "@/lib/help-cms";

const ICON_OPTIONS = [
  { value: "book", label: "Book" },
  { value: "search", label: "Search" },
  { value: "video", label: "Video" },
  { value: "message", label: "Message" },
];

export function HelpCmsEditor({
  data,
  onChange,
}: {
  data: HelpCmsMap;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Hero & sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Page heading" value={data["hero.heading"] ?? ""} onChange={(v) => onChange("hero.heading", v)} />
          <Field label="Subheading" value={data["hero.subheading"] ?? ""} onChange={(v) => onChange("hero.subheading", v)} textarea />
          <Field label="Search placeholder" value={data["hero.search_placeholder"] ?? ""} onChange={(v) => onChange("hero.search_placeholder", v)} />
          <Field label="Browse section title" value={data["browse.heading"] ?? ""} onChange={(v) => onChange("browse.heading", v)} />
          <Field label="FAQ section title" value={data["faq.heading"] ?? ""} onChange={(v) => onChange("faq.heading", v)} />
          <Field label="Support ticket title" value={data["ticket.heading"] ?? ""} onChange={(v) => onChange("ticket.heading", v)} />
          <Field label="Support ticket subheading" value={data["ticket.subheading"] ?? ""} onChange={(v) => onChange("ticket.subheading", v)} textarea />
        </CardContent>
      </Card>

      {Array.from({ length: MAX_HELP_CATEGORIES }, (_, idx) => idx + 1).map((catIndex) => {
        const keys = helpCategoryKeys(catIndex);
        const title = data[keys.title] ?? HELP_CMS_DEFAULTS[keys.title] ?? "";
        if (catIndex > 4 && !title.trim()) return null;
        return (
          <Card key={catIndex} className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Category {catIndex}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Title" value={data[keys.title] ?? ""} onChange={(v) => onChange(keys.title, v)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Icon</Label>
                  <Select
                    value={data[keys.icon] ?? HELP_CMS_DEFAULTS[keys.icon] ?? "book"}
                    onValueChange={(v) => onChange(keys.icon, v)}
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Icon color (Tailwind class)" value={data[keys.color] ?? ""} onChange={(v) => onChange(keys.color, v)} />
              </div>
              <Field label="Icon background (Tailwind class)" value={data[keys.bg] ?? ""} onChange={(v) => onChange(keys.bg, v)} />
              <p className="text-xs font-medium text-slate-500 pt-2">Articles (leave link empty or use #faq-123 to scroll to an FAQ)</p>
              {Array.from({ length: MAX_HELP_ARTICLES_PER_CATEGORY }, (_, j) => j + 1).map((artIndex) => {
                const ak = helpArticleKeys(catIndex, artIndex);
                const artTitle = data[ak.title] ?? "";
                const defaultTitle = HELP_CMS_DEFAULTS[ak.title];
                if (artIndex > 4 && !artTitle.trim() && !defaultTitle) return null;
                return (
                  <div key={artIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    <Field
                      label={`Article ${artIndex} title`}
                      value={artTitle}
                      onChange={(v) => onChange(ak.title, v)}
                    />
                    <Field
                      label="Link (optional)"
                      value={data[ak.link] ?? ""}
                      onChange={(v) => onChange(ak.link, v)}
                      placeholder="/tutorials or #faq-12"
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      {textarea ? (
        <Textarea
          className="mt-1 text-sm resize-none"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Input
          className="mt-1 h-8 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
