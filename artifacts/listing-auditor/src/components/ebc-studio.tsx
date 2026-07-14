import { useRef, useState, useCallback } from "react";
import { toJpeg } from "html-to-image";
import {
  Download, Palette, Loader2, ChevronDown, ChevronUp,
  Eye, EyeOff, RefreshCw, Wand2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGenerateEbc } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/use-team";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditData {
  productName: string;
  summary: string;
  bulletPoints: string[];
  keywords: string[];
  generatedBullets?: string[];
  generatedTitle?: string;
  imageUrls: string[];
}

interface EbcStudioProps {
  audit: AuditData;
  auditId: number;
}

interface ModuleState {
  visible: boolean;
  expanded: boolean;
}

interface HeroData {
  headline: string;
  subheadline: string;
  tagline: string;
}

interface Feature {
  icon: string;
  title: string;
  body: string;
}

interface FeaturesData {
  sectionTitle: string;
  features: Feature[];
}

interface StoryData {
  headline: string;
  body: string;
}

interface GridItem {
  emoji: string;
  title: string;
  desc: string;
}

interface GridData {
  sectionTitle: string;
  items: GridItem[];
}

interface ClosingData {
  headline: string;
  body: string;
  cta: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRAND_PRESETS = [
  { name: "Amazon Orange", primary: "#FF6B00", secondary: "#003087", accent: "#FFF3E0" },
  { name: "Navy & Gold",   primary: "#1A2F5E", secondary: "#C9A84C", accent: "#EEF2FF" },
  { name: "Forest Green", primary: "#1B5E20", secondary: "#33691E", accent: "#E8F5E9" },
  { name: "Royal Purple", primary: "#4A148C", secondary: "#880E4F", accent: "#F3E5F5" },
  { name: "Steel Blue",   primary: "#01579B", secondary: "#006064", accent: "#E1F5FE" },
  { name: "Crimson",      primary: "#B71C1C", secondary: "#880E4F", accent: "#FFEBEE" },
];

const ICONS = ["✦", "★", "◆", "●", "▶", "✔", "⚡", "🔑", "🎯", "🚀"];

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildDefault(audit: AuditData) {
  const bullets = audit.generatedBullets?.length ? audit.generatedBullets : audit.bulletPoints;
  const kws = audit.keywords.slice(0, 6);

  const hero: HeroData = {
    headline: truncate(audit.generatedTitle ?? audit.productName, 60),
    subheadline: `Premium Quality · Trusted by Thousands`,
    tagline: truncate(kws.length ? kws.slice(0, 3).join("  ·  ") : audit.productName, 80),
  };

  const features: FeaturesData = {
    sectionTitle: "Why Customers Love It",
    features: [
      {
        icon: "⚡",
        title: bullets[0] ? bullets[0].split(":")[0].replace(/^[^a-zA-Z]+/, "").slice(0, 30) : "Superior Performance",
        body: bullets[0] ? truncate(bullets[0], 120) : "Engineered for peak performance and lasting durability.",
      },
      {
        icon: "🔑",
        title: bullets[1] ? bullets[1].split(":")[0].replace(/^[^a-zA-Z]+/, "").slice(0, 30) : "Easy To Use",
        body: bullets[1] ? truncate(bullets[1], 120) : "Intuitive design makes setup and daily use effortless.",
      },
      {
        icon: "🎯",
        title: bullets[2] ? bullets[2].split(":")[0].replace(/^[^a-zA-Z]+/, "").slice(0, 30) : "Proven Results",
        body: bullets[2] ? truncate(bullets[2], 120) : "Backed by thousands of five-star reviews from happy customers.",
      },
    ],
  };

  const story: StoryData = {
    headline: "The Story Behind the Product",
    body: truncate(audit.summary || "We believe great products start with understanding what customers truly need. That belief drives every decision we make — from materials and design to packaging and support.", 420),
  };

  const grid: GridData = {
    sectionTitle: "Key Product Features",
    items: [
      {
        emoji: "✦",
        title: bullets[3] ? bullets[3].split(":")[0].replace(/^[^a-zA-Z]+/, "").slice(0, 28) : "Premium Build",
        desc: bullets[3] ? truncate(bullets[3], 90) : "Crafted with top-tier materials for longevity.",
      },
      {
        emoji: "★",
        title: bullets[4] ? bullets[4].split(":")[0].replace(/^[^a-zA-Z]+/, "").slice(0, 28) : "Customer First",
        desc: bullets[4] ? truncate(bullets[4], 90) : "Our dedicated support team is always here for you.",
      },
      {
        emoji: "◆",
        title: kws[3] ? kws[3].slice(0, 28) : "Versatile Use",
        desc: `Compatible with a wide range of applications — ${kws.slice(0, 4).join(", ") || "home, office, travel, and more"}.`,
      },
      {
        emoji: "●",
        title: kws[4] ? kws[4].slice(0, 28) : "Eco Friendly",
        desc: `Sustainably made with ${kws[5] ?? "responsible"} materials and minimal environmental footprint.`,
      },
    ],
  };

  const closing: ClosingData = {
    headline: `Experience the Difference`,
    body: `Join thousands of satisfied customers who chose ${truncate(audit.productName, 40)} for quality they can feel from day one.`,
    cta: "Order Now — Risk Free",
  };

  return { hero, features, story, grid, closing };
}

// ── Module wrapper ────────────────────────────────────────────────────────────

function ModulePanel({
  title, visible, expanded,
  onToggleVisible, onToggleExpand,
  children,
}: {
  title: string; visible: boolean; expanded: boolean;
  onToggleVisible: () => void; onToggleExpand: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("border-border/50 transition-opacity", !visible && "opacity-50")}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleVisible} title={visible ? "Hide module" : "Show module"}>
            {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && <CardContent className="pt-0 pb-4 px-4 space-y-3">{children}</CardContent>}
    </Card>
  );
}

// ── Canvas modules ────────────────────────────────────────────────────────────

function HeroModule({ data, colors }: { data: HeroData; colors: typeof BRAND_PRESETS[0] }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      padding: "56px 60px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 260, height: 260, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
      }} />
      <div style={{
        position: "absolute", bottom: -40, left: -40,
        width: 180, height: 180, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
        {data.tagline}
      </p>
      <h1 style={{ color: "#FFFFFF", fontSize: 36, fontWeight: 800, lineHeight: 1.2, margin: "0 0 16px", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
        {data.headline}
      </h1>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, lineHeight: 1.6, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
        {data.subheadline}
      </p>
      <div style={{
        display: "inline-block", marginTop: 28,
        background: "#FFFFFF", color: colors.primary,
        padding: "12px 32px", borderRadius: 4,
        fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
      }}>
        Shop Now →
      </div>
    </div>
  );
}

function FeaturesModule({ data, colors }: { data: FeaturesData; colors: typeof BRAND_PRESETS[0] }) {
  return (
    <div style={{ background: colors.accent, padding: "48px 60px" }}>
      <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 700, color: colors.primary, marginBottom: 36, letterSpacing: -0.3 }}>
        {data.sectionTitle}
      </h2>
      <div style={{ display: "flex", gap: 24 }}>
        {data.features.map((f, i) => (
          <div key={i} style={{ flex: 1, background: "#FFFFFF", borderRadius: 8, padding: "28px 24px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.primary, marginBottom: 10 }}>{f.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: "#555" }}>{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoryModule({ data, colors, imageUrl }: { data: StoryData; colors: typeof BRAND_PRESETS[0]; imageUrl?: string }) {
  return (
    <div style={{ background: "#FFFFFF", padding: "48px 60px", display: "flex", gap: 40, alignItems: "center" }}>
      <div style={{
        width: 280, flexShrink: 0, background: colors.accent,
        borderRadius: 8, height: 200, display: "flex",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <div style={{ textAlign: "center", color: colors.primary, opacity: 0.4 }}>
            <div style={{ fontSize: 36 }}>📷</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Brand Image</div>
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ width: 40, height: 4, background: colors.primary, borderRadius: 2, marginBottom: 16 }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.primary, marginBottom: 14, lineHeight: 1.3 }}>{data.headline}</h2>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: "#444" }}>{data.body}</p>
      </div>
    </div>
  );
}

function GridModule({ data, colors }: { data: GridData; colors: typeof BRAND_PRESETS[0] }) {
  return (
    <div style={{ background: "#F8F9FA", padding: "48px 60px" }}>
      <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 700, color: colors.primary, marginBottom: 32, letterSpacing: -0.3 }}>
        {data.sectionTitle}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {data.items.map((item, i) => (
          <div key={i} style={{ background: "#FFFFFF", borderRadius: 8, padding: "22px 24px", display: "flex", gap: 16, alignItems: "flex-start", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: colors.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              {item.emoji}
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.primary, marginBottom: 6 }}>{item.title}</h3>
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: "#555" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingModule({ data, colors }: { data: ClosingData; colors: typeof BRAND_PRESETS[0] }) {
  return (
    <div style={{
      background: colors.primary,
      padding: "48px 60px",
      textAlign: "center",
    }}>
      <h2 style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 800, marginBottom: 14, letterSpacing: -0.3 }}>{data.headline}</h2>
      <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 1.7, maxWidth: 500, marginLeft: "auto", marginRight: "auto", marginBottom: 28 }}>
        {data.body}
      </p>
      <div style={{
        display: "inline-block",
        background: "#FFFFFF", color: colors.primary,
        padding: "14px 36px", borderRadius: 4,
        fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
      }}>
        {data.cta}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function EbcStudio({ audit, auditId }: EbcStudioProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [colorIdx, setColorIdx] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colors = BRAND_PRESETS[colorIdx];

  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const generateEbc = useGenerateEbc();

  const defaults = buildDefault(audit);
  const [hero, setHero] = useState<HeroData>(defaults.hero);
  const [features, setFeatures] = useState<FeaturesData>(defaults.features);
  const [story, setStory] = useState<StoryData>(defaults.story);
  const [grid, setGrid] = useState<GridData>(defaults.grid);
  const [closing, setClosing] = useState<ClosingData>(defaults.closing);

  const [modules, setModules] = useState<Record<string, ModuleState>>({
    hero:     { visible: true, expanded: true },
    features: { visible: true, expanded: false },
    story:    { visible: true, expanded: false },
    grid:     { visible: true, expanded: false },
    closing:  { visible: true, expanded: false },
  });

  const toggle = (key: string, field: "visible" | "expanded") => {
    setModules(prev => ({ ...prev, [key]: { ...prev[key], [field]: !prev[key][field] } }));
  };

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    generateEbc.mutate(
      { id: auditId, data: { prompt: aiPrompt.trim() } },
      {
        onSuccess: (data) => {
          setHero({
            headline: data.heroHeadline,
            subheadline: data.heroSubheadline,
            tagline: data.heroTagline,
          });
          setFeatures({
            sectionTitle: features.sectionTitle,
            features: [
              { icon: data.feature1Icon, title: data.feature1Title, body: data.feature1Body },
              { icon: data.feature2Icon, title: data.feature2Title, body: data.feature2Body },
              { icon: data.feature3Icon, title: data.feature3Title, body: data.feature3Body },
            ],
          });
          setStory({ headline: data.storyHeadline, body: data.storyBody });
          setGrid({
            sectionTitle: data.gridTitle,
            items: [
              { emoji: "✦", title: data.grid1Title, desc: data.grid1Desc },
              { emoji: "★", title: data.grid2Title, desc: data.grid2Desc },
              { emoji: "◆", title: data.grid3Title, desc: data.grid3Desc },
              { emoji: "●", title: data.grid4Title, desc: data.grid4Desc },
            ],
          });
          setClosing({ headline: data.closingHeadline, body: data.closingBody, cta: data.closingCta });
          setShowAiPrompt(false);
          setAiPrompt("");
          refreshCreditBalances(queryClient);
          toast({ title: "A+ content generated", description: "All modules updated with AI-crafted copy." });
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Generation failed";
          toast({
            title: "Generation failed",
            description: msg.includes("spend limit") ? "OpenAI API usage limit reached. Check your OpenAI account billing or try again later." : msg,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toJpeg(canvasRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${audit.productName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_aplus_content.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  }, [audit.productName]);

  const handleReset = () => {
    const d = buildDefault(audit);
    setHero(d.hero);
    setFeatures(d.features);
    setStory(d.story);
    setGrid(d.grid);
    setClosing(d.closing);
  };

  const productImage = audit.imageUrls[0];

  const { canEdit } = useTeam();

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">A+ / EBC Content Studio</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Design Amazon-style Enhanced Brand Content and export as JPG</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleReset} title="Reset all content to AI defaults">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline" size="sm"
              onClick={() => { setShowAiPrompt(!showAiPrompt); setShowColorPicker(false); }}
              className={cn(showAiPrompt && "border-primary text-primary bg-primary/5")}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Generate with AI
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className="relative"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowAiPrompt(false); }}
          >
            <Palette className="w-3.5 h-3.5 mr-1.5" />
            Brand Color
            <span className="ml-2 w-3 h-3 rounded-full inline-block border" style={{ background: colors.primary }} />
          </Button>
          <Button onClick={handleExport} disabled={isExporting} size="sm">
            {isExporting
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Exporting…</>
              : <><Download className="w-3.5 h-3.5 mr-1.5" />Download JPG</>
            }
          </Button>
        </div>
      </div>

      {/* AI Prompt Panel */}
      {showAiPrompt && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary mt-1 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold">Generate A+ Content with AI</p>
                <p className="text-xs text-muted-foreground">
                  Describe your brand, audience, key benefits, or tone — the AI will craft all 5 modules to match.
                </p>
                <Textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder='e.g. "Target eco-conscious parents aged 25-40. Emphasize BPA-free materials, easy cleaning, and fun colors. Tone: warm and friendly."'
                  className="resize-none text-sm"
                  disabled={generateEbc.isPending}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim() || generateEbc.isPending}
                  >
                    {generateEbc.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                      : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Generate All Modules</>
                    }
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAiPrompt(false)} disabled={generateEbc.isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Color picker dropdown */}
      {showColorPicker && (
        <Card className="border-border/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Choose Brand Color Preset</p>
          <div className="flex flex-wrap gap-2">
            {BRAND_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => { setColorIdx(i); setShowColorPicker(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all",
                  colorIdx === i ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50"
                )}
              >
                <span className="w-4 h-4 rounded-full border" style={{ background: preset.primary }} />
                {preset.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── Editor Panel ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">Edit Modules</p>

          {/* Hero */}
          <ModulePanel title="① Hero Banner" {...modules.hero}
            onToggleVisible={() => toggle("hero", "visible")}
            onToggleExpand={() => toggle("hero", "expanded")}
          >
            <label className="text-xs font-medium text-slate-600">Headline</label>
            <Input value={hero.headline} onChange={e => setHero(p => ({ ...p, headline: e.target.value }))} maxLength={70} />
            <label className="text-xs font-medium text-slate-600">Sub-headline</label>
            <Input value={hero.subheadline} onChange={e => setHero(p => ({ ...p, subheadline: e.target.value }))} />
            <label className="text-xs font-medium text-slate-600">Tagline (top small text)</label>
            <Input value={hero.tagline} onChange={e => setHero(p => ({ ...p, tagline: e.target.value }))} />
          </ModulePanel>

          {/* Features */}
          <ModulePanel title="② 3-Column Features" {...modules.features}
            onToggleVisible={() => toggle("features", "visible")}
            onToggleExpand={() => toggle("features", "expanded")}
          >
            <label className="text-xs font-medium text-slate-600">Section Title</label>
            <Input value={features.sectionTitle} onChange={e => setFeatures(p => ({ ...p, sectionTitle: e.target.value }))} />
            {features.features.map((f, i) => (
              <div key={i} className="space-y-2 border-t pt-3 mt-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={f.icon}
                    onChange={e => setFeatures(p => ({ ...p, features: p.features.map((x, j) => j === i ? { ...x, icon: e.target.value } : x) }))}
                    className="border rounded px-2 py-1 text-sm w-16 bg-white"
                  >
                    {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <Input
                    placeholder="Title"
                    value={f.title}
                    maxLength={35}
                    onChange={e => setFeatures(p => ({ ...p, features: p.features.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                  />
                </div>
                <Textarea
                  rows={2}
                  value={f.body}
                  maxLength={140}
                  onChange={e => setFeatures(p => ({ ...p, features: p.features.map((x, j) => j === i ? { ...x, body: e.target.value } : x) }))}
                  className="text-xs resize-none"
                />
              </div>
            ))}
          </ModulePanel>

          {/* Brand Story */}
          <ModulePanel title="③ Brand Story" {...modules.story}
            onToggleVisible={() => toggle("story", "visible")}
            onToggleExpand={() => toggle("story", "expanded")}
          >
            <label className="text-xs font-medium text-slate-600">Headline</label>
            <Input value={story.headline} onChange={e => setStory(p => ({ ...p, headline: e.target.value }))} />
            <label className="text-xs font-medium text-slate-600">Body Text</label>
            <Textarea rows={4} value={story.body} maxLength={440}
              onChange={e => setStory(p => ({ ...p, body: e.target.value }))}
              className="resize-none text-sm"
            />
            {productImage && (
              <p className="text-xs text-muted-foreground">Product image auto-used from listing</p>
            )}
          </ModulePanel>

          {/* Feature Grid */}
          <ModulePanel title="④ Feature Grid (2×2)" {...modules.grid}
            onToggleVisible={() => toggle("grid", "visible")}
            onToggleExpand={() => toggle("grid", "expanded")}
          >
            <label className="text-xs font-medium text-slate-600">Section Title</label>
            <Input value={grid.sectionTitle} onChange={e => setGrid(p => ({ ...p, sectionTitle: e.target.value }))} />
            {grid.items.map((item, i) => (
              <div key={i} className="space-y-2 border-t pt-3 mt-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={item.emoji}
                    onChange={e => setGrid(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x) }))}
                    className="border rounded px-2 py-1 text-sm w-16 bg-white"
                  >
                    {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <Input placeholder="Title" value={item.title} maxLength={32}
                    onChange={e => setGrid(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                  />
                </div>
                <Textarea rows={2} value={item.desc} maxLength={110} className="text-xs resize-none"
                  onChange={e => setGrid(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) }))}
                />
              </div>
            ))}
          </ModulePanel>

          {/* Closing */}
          <ModulePanel title="⑤ Closing CTA" {...modules.closing}
            onToggleVisible={() => toggle("closing", "visible")}
            onToggleExpand={() => toggle("closing", "expanded")}
          >
            <label className="text-xs font-medium text-slate-600">Headline</label>
            <Input value={closing.headline} onChange={e => setClosing(p => ({ ...p, headline: e.target.value }))} />
            <label className="text-xs font-medium text-slate-600">Body</label>
            <Textarea rows={2} value={closing.body} maxLength={200}
              onChange={e => setClosing(p => ({ ...p, body: e.target.value }))} className="resize-none text-sm"
            />
            <label className="text-xs font-medium text-slate-600">Button Text</label>
            <Input value={closing.cta} onChange={e => setClosing(p => ({ ...p, cta: e.target.value }))} maxLength={40} />
          </ModulePanel>

          {/* Keyword tags preview */}
          {audit.keywords.length > 0 && (
            <Card className="border-border/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {audit.keywords.slice(0, 12).map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Canvas Preview ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Canvas Preview (970px · Amazon A+ Standard)</p>
            <Badge variant="outline" className="text-xs font-mono">JPG export</Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm bg-white">
            <div
              ref={canvasRef}
              style={{
                width: 970,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                background: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              {modules.hero.visible && <HeroModule data={hero} colors={colors} />}
              {modules.features.visible && <FeaturesModule data={features} colors={colors} />}
              {modules.story.visible && <StoryModule data={story} colors={colors} imageUrl={productImage} />}
              {modules.grid.visible && <GridModule data={grid} colors={colors} />}
              {modules.closing.visible && <ClosingModule data={closing} colors={colors} />}

              {/* Footer bar */}
              <div style={{
                background: "#F1F1F1", padding: "12px 60px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, color: "#888" }}>© {new Date().getFullYear()} · All Rights Reserved</span>
                <span style={{ fontSize: 11, color: "#888" }}>Amazon A+ Enhanced Brand Content</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
