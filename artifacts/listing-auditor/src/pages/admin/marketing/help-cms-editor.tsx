import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  MAX_HELP_ARTICLES_PER_CATEGORY,
  MAX_HELP_CATEGORIES,
  clearHelpArticleKeys,
  clearHelpCategoryKeys,
  helpArticleKeys,
  helpCategoryKeys,
  helpCmsText,
  type HelpCmsMap,
} from "@/lib/help-cms";

const ICON_OPTIONS = [
  { value: "book", label: "Book" },
  { value: "search", label: "Search" },
  { value: "video", label: "Video" },
  { value: "message", label: "Message" },
];

export type AdminFaqRef = { id: number; question: string };

function categoryVisible(data: HelpCmsMap, catIndex: number): boolean {
  const keys = helpCategoryKeys(catIndex);
  if (helpCmsText(data, keys.title)) return true;
  for (let j = 1; j <= MAX_HELP_ARTICLES_PER_CATEGORY; j++) {
    const ak = helpArticleKeys(catIndex, j);
    if (helpCmsText(data, ak.title)) return true;
  }
  return false;
}

function articleVisible(data: HelpCmsMap, catIndex: number, artIndex: number): boolean {
  const ak = helpArticleKeys(catIndex, artIndex);
  return Boolean(helpCmsText(data, ak.title));
}

function firstEmptyCategoryIndex(data: HelpCmsMap): number | null {
  for (let i = 1; i <= MAX_HELP_CATEGORIES; i++) {
    if (!categoryVisible(data, i)) return i;
  }
  return null;
}

function firstEmptyArticleIndex(data: HelpCmsMap, catIndex: number): number | null {
  for (let j = 1; j <= MAX_HELP_ARTICLES_PER_CATEGORY; j++) {
    if (!articleVisible(data, catIndex, j)) return j;
  }
  return null;
}

export function HelpCmsEditor({
  data,
  onChange,
  onBatchChange,
  faqs = [],
}: {
  data: HelpCmsMap;
  onChange: (key: string, val: string) => void;
  onBatchChange: (updates: Record<string, string>) => void;
  faqs?: AdminFaqRef[];
}) {
  const visibleCategories = Array.from({ length: MAX_HELP_CATEGORIES }, (_, i) => i + 1).filter((i) =>
    categoryVisible(data, i),
  );
  const canAddCategory = firstEmptyCategoryIndex(data) !== null;

  function addCategory() {
    const idx = firstEmptyCategoryIndex(data);
    if (idx === null) return;
    const keys = helpCategoryKeys(idx);
    onBatchChange({
      [keys.title]: "New category",
      [keys.icon]: "book",
      [keys.color]: "text-slate-600",
      [keys.bg]: "bg-slate-50",
    });
  }

  function removeCategory(catIndex: number) {
    const updates: Record<string, string> = {};
    for (const key of clearHelpCategoryKeys(catIndex)) {
      updates[key] = "";
    }
    onBatchChange(updates);
  }

  function addArticle(catIndex: number) {
    const artIndex = firstEmptyArticleIndex(data, catIndex);
    if (artIndex === null) return;
    const ak = helpArticleKeys(catIndex, artIndex);
    onBatchChange({ [ak.title]: "New article" });
  }

  function removeArticle(catIndex: number, artIndex: number) {
    const updates: Record<string, string> = {};
    for (const key of clearHelpArticleKeys(catIndex, artIndex)) {
      updates[key] = "";
    }
    onBatchChange(updates);
  }

  function applyFaqPick(catIndex: number, artIndex: number, faqId: string) {
    const ak = helpArticleKeys(catIndex, artIndex);
    onBatchChange({ [ak.faqId]: faqId });
  }

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

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Categories ({visibleCategories.length})</p>
        <Button type="button" variant="outline" size="sm" disabled={!canAddCategory} onClick={addCategory}>
          <Plus className="w-4 h-4 mr-1" /> Add category
        </Button>
      </div>

      {visibleCategories.map((catIndex) => {
        const keys = helpCategoryKeys(catIndex);
        const articles = Array.from({ length: MAX_HELP_ARTICLES_PER_CATEGORY }, (_, j) => j + 1).filter((j) =>
          articleVisible(data, catIndex, j),
        );
        const canAddArticle = firstEmptyArticleIndex(data, catIndex) !== null;

        return (
          <Card key={catIndex} className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Category {catIndex}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => removeCategory(catIndex)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete category
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Title" value={helpCmsText(data, keys.title)} onChange={(v) => onChange(keys.title, v)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Icon</Label>
                  <Select value={helpCmsText(data, keys.icon) || "book"} onValueChange={(v) => onChange(keys.icon, v)}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Icon color (Tailwind class)" value={helpCmsText(data, keys.color)} onChange={(v) => onChange(keys.color, v)} />
              </div>
              <Field label="Icon background (Tailwind class)" value={helpCmsText(data, keys.bg)} onChange={(v) => onChange(keys.bg, v)} />

              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-xs font-medium text-slate-500">Articles — paste FAQ ID or link (FAQ ID wins)</p>
                <Button type="button" variant="outline" size="sm" disabled={!canAddArticle} onClick={() => addArticle(catIndex)}>
                  <Plus className="w-4 h-4 mr-1" /> Add article
                </Button>
              </div>

              {articles.map((artIndex) => {
                const ak = helpArticleKeys(catIndex, artIndex);
                const faqIdRaw = Object.prototype.hasOwnProperty.call(data, ak.faqId) ? (data[ak.faqId] ?? "") : "";
                const linkRaw = Object.prototype.hasOwnProperty.call(data, ak.link) ? (data[ak.link] ?? "") : "";

                return (
                  <div key={artIndex} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">Article {artIndex}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-600 hover:text-red-700"
                        onClick={() => removeArticle(catIndex, artIndex)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                    <Field
                      label="Title"
                      value={helpCmsText(data, ak.title)}
                      onChange={(v) => onChange(ak.title, v)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field
                        label="FAQ ID (optional)"
                        value={faqIdRaw}
                        onChange={(v) => onChange(ak.faqId, v.replace(/^#?faq-?/i, "").trim())}
                        placeholder="e.g. 12"
                      />
                      <Field
                        label="Link (optional)"
                        value={linkRaw}
                        onChange={(v) => onChange(ak.link, v)}
                        placeholder="/tutorials or https://..."
                      />
                    </div>
                    {faqs.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-500">Pick from FAQ admin</Label>
                        <Select
                          value={faqIdRaw && /^\d+$/.test(faqIdRaw) ? faqIdRaw : "__none__"}
                          onValueChange={(v) => {
                            if (v === "__none__") onChange(ak.faqId, "");
                            else applyFaqPick(catIndex, artIndex, v);
                          }}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue placeholder="Select FAQ…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {faqs.map((f) => (
                              <SelectItem key={f.id} value={String(f.id)}>
                                #{f.id} — {f.question.slice(0, 60)}{f.question.length > 60 ? "…" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
