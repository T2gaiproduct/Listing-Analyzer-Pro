import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  allHeroSlides,
  createHeroSlide,
  HERO_AUTOPLAY_ENABLED_KEY,
  HERO_AUTOPLAY_INTERVAL_KEY,
  HERO_SLIDES_JSON_KEY,
  serializeHeroSlides,
  type HeroSlide,
} from "@/lib/hero-slides";
import type { HomepageCmsMap } from "@/lib/homepage-cms";

interface HeroSlidesEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

export function HeroSlidesEditor({ data, onChange }: HeroSlidesEditorProps) {
  const slides = allHeroSlides(data);

  function updateSlides(next: HeroSlide[]) {
    onChange(HERO_SLIDES_JSON_KEY, serializeHeroSlides(next));
  }

  function updateSlide(index: number, patch: Partial<HeroSlide>) {
    const next = slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide));
    updateSlides(next);
  }

  function addSlide() {
    updateSlides([
      ...slides,
      createHeroSlide({
        badgeText: "New Banner",
        headingLine1: "Your headline here.",
        headingHighlight: "Highlight text.",
        subheading: "Add a short description for this slide.",
      }),
    ]);
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    updateSlides(slides.filter((_, i) => i !== index));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    updateSlides(next);
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">Hero slider banners</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Add multiple slides — each with its own headline and CTA buttons.</p>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0" onClick={addSlide}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Slide
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {slides.map((slide, index) => (
            <Card key={slide.id} className="border border-slate-200 shadow-none">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CardTitle className="text-sm font-medium text-slate-800 truncate">
                    Slide {index + 1}
                    {slide.headingLine1 ? ` — ${slide.headingLine1}` : ""}
                  </CardTitle>
                  {!slide.enabled && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => moveSlide(index, -1)}>
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === slides.length - 1} onClick={() => moveSlide(index, 1)}>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" disabled={slides.length <= 1} onClick={() => removeSlide(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={slide.enabled} onCheckedChange={(v) => updateSlide(index, { enabled: v })} />
                  <span className="text-xs text-slate-600">Show this slide on homepage</span>
                </label>
                <div>
                  <Label className="text-xs text-slate-500">Badge text</Label>
                  <Input className="mt-1 h-8 text-sm" value={slide.badgeText} onChange={(e) => updateSlide(index, { badgeText: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Heading line 1</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.headingLine1} onChange={(e) => updateSlide(index, { headingLine1: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Heading highlight (orange)</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.headingHighlight} onChange={(e) => updateSlide(index, { headingHighlight: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Subheading</Label>
                  <Textarea className="mt-1 text-sm resize-none" rows={2} value={slide.subheading} onChange={(e) => updateSlide(index, { subheading: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <Label className="text-xs text-slate-500">Primary CTA text</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.ctaPrimaryText} onChange={(e) => updateSlide(index, { ctaPrimaryText: e.target.value })} placeholder="Get Started Free" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Primary CTA URL</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.ctaPrimaryUrl} onChange={(e) => updateSlide(index, { ctaPrimaryUrl: e.target.value })} placeholder="/sign-up" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Secondary CTA text</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.ctaSecondaryText} onChange={(e) => updateSlide(index, { ctaSecondaryText: e.target.value })} placeholder="See How It Works" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Secondary CTA URL</Label>
                    <Input className="mt-1 h-8 text-sm" value={slide.ctaSecondaryUrl} onChange={(e) => updateSlide(index, { ctaSecondaryUrl: e.target.value })} placeholder="/features" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Slider settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={data[HERO_AUTOPLAY_ENABLED_KEY] !== "false"}
              onCheckedChange={(v) => onChange(HERO_AUTOPLAY_ENABLED_KEY, v ? "true" : "false")}
            />
            <span className="text-xs text-slate-600">Auto-rotate slides</span>
          </label>
          <div>
            <Label className="text-xs text-slate-500">Seconds between slides</Label>
            <Input
              className="mt-1 h-8 text-sm max-w-[120px]"
              type="number"
              min={3}
              max={30}
              value={data[HERO_AUTOPLAY_INTERVAL_KEY] ?? "6"}
              onChange={(e) => onChange(HERO_AUTOPLAY_INTERVAL_KEY, e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
