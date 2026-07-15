import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Monitor,
  Camera,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Wand2,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  X,
  Zap,
  Plus,
  Lightbulb,
  Code2,
  Eye,
  Save,
  Copy,
  LayoutTemplate,
  ListChecks,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshCreditBalances } from "@/lib/credit-queries";
import {
  useCreateAudit,
  usePatchAudit,
  useGenerateContent,
  useGenerateContentDirect,
  useGetAudit,
  getGetAuditStatsQueryKey,
  getListAuditsQueryKey,
  getGetAuditQueryKey,
  getGetRecentsQueryKey,
} from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Category Dropdown Portal (fixes autoFocus + full-width) ──────────── */
function CategoryPortalDropdown({
  catPos,
  catSearch,
  setCatSearch,
  filteredCats,
  category,
  setCategory,
  setCatOpen,
}: {
  catPos: { top: number; left: number; width: number };
  catSearch: string;
  setCatSearch: (v: string) => void;
  filteredCats: string[];
  category: string;
  setCategory: (v: string) => void;
  setCatOpen: (v: boolean) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  return (
    <div
      data-cat-portal
      style={{ position: "fixed", top: catPos.top, left: catPos.left, width: catPos.width, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[60vh] overflow-y-auto"
    >
      <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2">
        <input
          ref={searchRef}
          value={catSearch}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatSearch(e.target.value)}
          placeholder="Search categories…"
          className="w-full text-sm focus:outline-none text-slate-700 placeholder-slate-400"
        />
      </div>
      {filteredCats.length === 0
        ? <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
        : filteredCats.map((c) => (
          <div
            key={c}
            className={cn("px-3 py-2 text-sm cursor-pointer hover:bg-orange-50", category === c ? "bg-orange-50 text-orange-600 font-medium" : "text-slate-700")}
            onClick={() => { setCategory(c); setCatSearch(""); setCatOpen(false); }}
          >
            {c}
          </div>
        ))
      }
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────── */
type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; key: string; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 1, key: "upload",   label: "UPLOAD",     sub: "Upload product images",   icon: Upload    },
  { id: 2, key: "listing",  label: "LISTING",    sub: "Create listing content",  icon: FileText  },
  { id: 3, key: "graphics", label: "GRAPHICS",   sub: "Create product graphics", icon: ImageIcon },
  { id: 4, key: "aplus",    label: "A+ CONTENT", sub: "Create A+ content",       icon: Sparkles  },
  { id: 5, key: "export",   label: "EXPORT",     sub: "Export & publish",        icon: Download  },
];

interface AplusModule {
  id: "hero" | "features" | "comparison" | "brand_story";
  title: string;
  description: string;
  headline: string;
  body: string;
  imageUrl: string;
}

interface AplusContent {
  heroHeadline: string;
  heroSubheadline: string;
  heroTagline: string;
  feature1Icon: string;
  feature1Title: string;
  feature1Body: string;
  feature2Icon: string;
  feature2Title: string;
  feature2Body: string;
  feature3Icon: string;
  feature3Title: string;
  feature3Body: string;
  storyHeadline: string;
  storyBody: string;
  gridTitle: string;
  grid1Title: string;
  grid1Desc: string;
  grid2Title: string;
  grid2Desc: string;
  grid3Title: string;
  grid3Desc: string;
  grid4Title: string;
  grid4Desc: string;
  closingHeadline: string;
  closingBody: string;
  closingCta: string;
}

const APLUS_MODULE_CARDS = [
  { id: "hero" as const, icon: LayoutTemplate, title: "Hero Banner", desc: "Full-width product hero image with headline" },
  { id: "features" as const, icon: ListChecks, title: "Feature Highlights", desc: "Icon + text modules showcasing key features" },
  { id: "comparison" as const, icon: BarChart3, title: "Comparison Chart", desc: "Compare your product against competitors" },
  { id: "brand_story" as const, icon: BookOpen, title: "Brand Story", desc: "Tell your brand story with rich imagery" },
];

type AplusModuleId = AplusModule["id"];
const ALL_APLUS_MODULE_IDS: AplusModuleId[] = APLUS_MODULE_CARDS.map((m) => m.id);

function formatAplusApiError(status: number, apiError?: string): string {
  if (apiError) return apiError;
  if (status === 404) {
    return "A+ API endpoint not found. Rebuild and restart the API server on latest-code, then try again.";
  }
  if (status === 524 || status === 504 || status === 408) {
    return "Generation timed out at the network edge. If modules are still generating, wait for progress to update.";
  }
  return `Failed (${status})`;
}

function readAplusFromAudit(generatedImages: unknown): {
  status: string;
  content: AplusContent | null;
  modules: AplusModule[];
  progress: { done: number; total: number };
  errorMessage?: string;
} {
  const aplus = (generatedImages as { aplus?: {
    status?: string;
    content?: AplusContent;
    modules?: AplusModule[];
    progress?: { done: number; total: number };
    errorMessage?: string;
  } } | null)?.aplus;

  if (!aplus) {
    return { status: "idle", content: null, modules: [], progress: { done: 0, total: 4 } };
  }

  if (aplus.status) {
    return {
      status: aplus.status,
      content: aplus.content ?? null,
      modules: aplus.modules ?? [],
      progress: aplus.progress ?? { done: aplus.modules?.length ?? 0, total: 4 },
      errorMessage: aplus.errorMessage,
    };
  }

  // Legacy shape: { content, modules } without status
  if (aplus.content && aplus.modules?.length) {
    return {
      status: "completed",
      content: aplus.content,
      modules: aplus.modules,
      progress: { done: aplus.modules.length, total: aplus.modules.length },
    };
  }

  return { status: "idle", content: null, modules: [], progress: { done: 0, total: 4 } };
}

/* ── localStorage helpers ───────────────────────────────────────────────── */
/* No client-side draft/recent storage — server-side recents via sidebar only */

/* ── Loading messages per step ──────────────────────────────────────────── */
const LOADING_MESSAGES: Record<StepId, string[]> = {
  1: [
    "Reading your product images…",
    "Extracting product details…",
    "Optimizing image quality…",
    "Preparing for AI analysis…",
    "Almost ready…",
  ],
  2: [
    "Crafting your product title…",
    "Writing bullet points…",
    "Researching backend keywords…",
    "Building your HTML description…",
    "Polishing the listing copy…",
    "Finalizing your content…",
  ],
  3: [
    "Processing product images…",
    "Selecting best composition…",
    "Applying style presets…",
    "Generating AI graphics…",
    "Rendering final images…",
  ],
  4: [
    "Designing module layouts…",
    "Writing headline copy…",
    "Generating banner imagery…",
    "Assembling A+ modules…",
    "Applying brand guidelines…",
  ],
  5: [
    "Compiling all assets…",
    "Packaging your files…",
    "Optimizing for download…",
    "Almost ready…",
  ],
};

/* ── Amazon categories (real top-level browse nodes + popular sub-categories) ── */
const AMAZON_CATEGORIES = [
  "Appliances", "Arts, Crafts & Sewing", "Automotive", "Baby", "Beauty & Personal Care",
  "Books", "CDs & Vinyl", "Camera & Photo", "Cell Phones & Accessories",
  "Clothing, Shoes & Jewelry", "Collectibles & Fine Art", "Computers & Accessories",
  "Electronics", "Garden & Outdoor", "Grocery & Gourmet Food", "Handmade", "Health & Household",
  "Home & Kitchen", "Industrial & Scientific", "Kindle Store", "Kitchen & Dining",
  "Luggage & Travel Gear", "Luxury Beauty", "Magazine Subscriptions", "Movies & TV",
  "Musical Instruments", "Office Products", "Pet Supplies", "Prime Video", "Software",
  "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games", "Video Games",
  "Watches", "Music", "Gift Cards", "Amazon Pharmacy", "Amazon Launchpad",
  "Subscribe & Save", "Climate Pledge Friendly", "Smart Home", "Amazon Renewed",
  "Baby Registry", "Wedding Registry", "Gift Registry", "International Shopping",
  "Trade-In", "School Supplies", "College Textbooks", "Books for Kids",
  "Women's Fashion", "Men's Fashion", "Girls' Fashion", "Boys' Fashion",
  "Baby Clothing", "Maternity", "Big & Tall", "Uniforms, Work & Safety",
  "Activewear", "Contemporary & Designer", "Luggage & Bags", "Travel Accessories",
  "Wedding & Engagement", "Fashion Jewelry", "Fine Jewelry", "Wedding Bands",
  "Engagement Rings", "Athletic Shoes", "Boots", "Fashion Sneakers", "Outdoor Shoes",
  "Slippers", "Work & Safety Shoes", "Shoe Care & Accessories", "Costumes & Accessories",
  "Handbags & Wallets", "Backpacks", "Diaper Bags", "Kids' Backpacks",
  "Laptop Bags", "Briefcases", "Messenger Bags", "Tote Bags", "Crossbody Bags",
  "Clutches & Evening Bags", "Wallets, Card Cases & Money Organizers", "Luggage Sets",
  "Carry-Ons", "Garment Bags", "Luggage Carts", "Packing Organizers", "Travel Duffels",
  "Travel Totes", "Umbrellas", "Women's Sunglasses", "Men's Sunglasses",
  "Unisex Sunglasses", "Sunglasses Accessories", "Jewelry Boxes & Organizers",
  "Women's Rings", "Women's Necklaces", "Women's Bracelets", "Women's Earrings",
  "Women's Body Jewelry", "Men's Rings", "Men's Necklaces", "Men's Bracelets",
  "Men's Earrings & Body Jewelry", "Men's Tie Clips & Tacks", "Men's Cuff Links",
  "Men's Tie Pins, Clips & Bars", "Men's Collar Stays", "Men's Tie Sets",
  "Women's Anklets", "Women's Brooches & Pins", "Women's Charms & Charm Bracelets",
  "Women's Hair Jewelry", "Women's Jewelry Sets", "Women's Pendants & Coins",
  "Women's Piercing Jewelry", "Women's Watches", "Women's Smartwatches",
  "Women's Pocket Watches", "Women's Watch Bands", "Men's Watches", "Men's Smartwatches",
  "Men's Pocket Watches", "Men's Watch Bands", "Women's Athletic Shoes",
  "Women's Boots", "Women's Fashion Sneakers", "Women's Flats", "Women's Loafers",
  "Women's Mules & Clogs", "Women's Outdoor Shoes", "Women's Pumps",
  "Women's Sandals", "Women's Slippers", "Women's Walking Shoes", "Women's Work & Safety",
  "Men's Athletic Shoes", "Men's Boots", "Men's Fashion Sneakers", "Men's Loafers",
  "Men's Outdoor Shoes", "Men's Oxfords", "Men's Sandals", "Men's Slippers",
  "Men's Walking Shoes", "Men's Work & Safety", "Girls' Athletic Shoes",
  "Girls' Boots", "Girls' Fashion Sneakers", "Girls' Flats", "Girls' Outdoor Shoes",
  "Girls' Sandals", "Girls' School Shoes", "Girls' Slippers", "Boys' Athletic Shoes",
  "Boys' Boots", "Boys' Fashion Sneakers", "Boys' Outdoor Shoes", "Boys' Sandals",
  "Boys' School Shoes", "Boys' Slippers", "Boys' Sneakers", "Baby Shoes", "Baby Boots",
  "Baby Outdoor Shoes", "Baby Sneakers", "Baby Athletic", "Baby Sandals",
  "Baby Slippers", "Baby Walking Shoes", "Baby Accessories", "Baby Girls", "Baby Boys",
  "Unisex Baby", "Baby Jewelry", "Hair Accessories", "Women's Belts", "Women's Earmuffs",
  "Women's Eyewear & Accessories", "Women's Gloves & Mittens", "Women's Hats & Caps",
  "Women's Scarves & Wraps", "Women's Sleep & Lounge", "Women's Socks & Hosiery",
  "Women's Suiting & Blazers", "Women's Underwear", "Men's Belts", "Men's Earmuffs",
  "Men's Eyewear & Accessories", "Men's Gloves & Mittens", "Men's Hats & Caps",
  "Men's Scarves", "Men's Sleep & Lounge", "Men's Socks", "Men's Underwear",
  "Men's Suiting & Blazers", "Girls' Belts", "Girls' Earmuffs", "Girls' Eyewear & Accessories",
  "Girls' Gloves & Mittens", "Girls' Hats & Caps", "Girls' Scarves & Wraps",
  "Girls' Socks & Tights", "Girls' Underwear", "Boys' Belts", "Boys' Earmuffs",
  "Boys' Eyewear & Accessories", "Boys' Gloves & Mittens", "Boys' Hats & Caps",
  "Boys' Scarves", "Boys' Socks", "Boys' Underwear",
];

/* ── Image types ────────────────────────────────────────────────────────── */
const IMAGE_TYPES = [
  { id: "hero",        label: "Hero Shot",        desc: "White background, product centered", icon: "🏆" },
  { id: "lifestyle",   label: "Lifestyle In-Use",  desc: "Product in use, real environment",   icon: "🌅" },
  { id: "callouts",    label: "Feature Callouts",  desc: "Numbered features, arrows",          icon: "🔢" },
  { id: "size",        label: "Size Reference",    desc: "Scale comparison with dimensions",   icon: "📏" },
  { id: "beforeafter", label: "Before / After",    desc: "Transformation comparison",          icon: "⚡" },
  { id: "bundle",      label: "Bundle Shot",       desc: "All included items",                 icon: "📦" },
  { id: "social",      label: "Social Proof",      desc: "Ratings & reviews",                  icon: "⭐" },
  { id: "custom",      label: "Generate Custom",   desc: "Custom prompt",                      icon: "✨" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Loading Panel Component
═══════════════════════════════════════════════════════════════════════════ */
function CreatingPanel({
  stepId,
  onCancel,
}: {
  stepId: StepId;
  onCancel: () => void;
}) {
  const messages = LOADING_MESSAGES[stepId];
  const [msgIdx, setMsgIdx]     = useState(0);
  const [visible, setVisible]   = useState(true);   // for fade animation
  const [progress, setProgress] = useState(0);
  const stepLabel = STEPS.find((s) => s.id === stepId)?.label ?? "";

  /* Cycle messages with fade */
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, [messages.length]);

  /* Advance progress bar — fast at start, slows near 90% */
  useEffect(() => {
    let current = 0;
    const tick = setInterval(() => {
      current += current < 60 ? 3 : current < 80 ? 1.2 : current < 90 ? 0.4 : 0.05;
      setProgress(Math.min(current, 92));
    }, 300);
    return () => clearInterval(tick);
  }, []);

  return (
    <>
      {/* Dim overlay over the rest of the content */}
      <div
        className="absolute inset-0 bg-slate-900/10 z-10"
        style={{ left: 320 }}
        onClick={onCancel}
      />

      {/* Sliding panel */}
      <div
        className="absolute left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-200 shadow-2xl z-20 flex flex-col"
        style={{ animation: "slideInLeft 0.28s cubic-bezier(0.25,0.46,0.45,0.94) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Creating {stepLabel}</span>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Animated icon */}
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-6">
          {/* Pulsing rings */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute w-20 h-20 rounded-full bg-orange-100 opacity-60"
              style={{ animation: "pulseRing 2s ease-out infinite" }}
            />
            <div
              className="absolute w-14 h-14 rounded-full bg-orange-200 opacity-50"
              style={{ animation: "pulseRing 2s ease-out infinite 0.4s" }}
            />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200">
              <Sparkles
                className="w-6 h-6 text-white"
                style={{ animation: "spinSlow 3s linear infinite" }}
              />
            </div>
          </div>

          {/* Status message */}
          <div className="text-center min-h-[3rem] flex items-center justify-center">
            <p
              className="text-sm font-medium text-slate-700 transition-opacity duration-300 text-center leading-relaxed"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {messages[msgIdx]}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-slate-400">{Math.round(progress)}%</p>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {LOADING_MESSAGES[stepId].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === msgIdx
                    ? "w-4 h-1.5 bg-orange-500"
                    : "w-1.5 h-1.5 bg-slate-200"
                )}
              />
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            This may take a few moments.<br />You can cancel at any time.
          </p>
        </div>

        {/* Cancel button */}
        <div className="px-5 py-4 border-t border-slate-100">
          <Button
            variant="outline"
            className="w-full rounded-xl border-slate-200 text-slate-500 hover:text-slate-700 text-sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes pulseRing {
          0%   { transform: scale(0.85); opacity: 0.6; }
          50%  { transform: scale(1.1);  opacity: 0.3; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════════════════ */
export default function AuditWorkflow() {
  const [, nav]         = useLocation();
  const search          = useSearch();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const [activeStep, setActiveStep] = useState<StepId>(1);
  const [projectId] = useState(() => `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  /* ── Creating panel state ── */
  const [isCreating, setIsCreating]         = useState(false);
  const [creatingStep, setCreatingStep]     = useState<StepId>(1);

  /* ── Resume from DB audit ID (sidebar server-side recents) ── */
  const [resumeAuditId] = useState(() => {
    const params = new URLSearchParams(search);
    const resume = params.get("resume");
    return resume ? parseInt(resume, 10) : null;
  });

  /* ── Guard: only restore from the newest data (stale → fresh still restores) ── */
  const lastRestoredAtRef = useRef<string | null>(null);
  const stepRestoredForAuditIdRef = useRef<number | null>(null);

  /* ── Upload step state ── */
  const fileRef    = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [projectName, setProjectName]   = useState("");
  const [brandName, setBrandName]       = useState("");
  const [productName, setProductName]   = useState("");
  const [category, setCategory]         = useState("");
  const [catSearch, setCatSearch]       = useState("");
  const [catOpen, setCatOpen]           = useState(false);
  const catRef     = useRef<HTMLDivElement>(null);
  const catBtnRef  = useRef<HTMLButtonElement>(null);
  const [catPos, setCatPos] = useState({ top: 0, left: 0, width: 0 });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading]       = useState(false);

  /* ── Listing step state ── */
  const [currentAuditId, setCurrentAuditId] = useState<number | null>(null);
  const [generatedContent, setGeneratedContent] = useState<null | { title: string; bulletPoints: string[]; keywords: string[]; htmlDescription: string }>(null);
  const [descViewMode, setDescViewMode] = useState<"preview" | "code">("preview");
  const [isDirty, setIsDirty] = useState(false);
  const createAudit  = useCreateAudit();
  const patchAudit   = usePatchAudit();
  const generateContent = useGenerateContent();
  const generateContentDirect = useGenerateContentDirect();
  const { data: auditData } = useGetAudit(currentAuditId ?? 0, {
    query: { enabled: currentAuditId !== null, queryKey: getGetAuditQueryKey(currentAuditId ?? 0) },
  });

  useEffect(() => {
    if (resumeAuditId && !isNaN(resumeAuditId)) {
      setCurrentAuditId(resumeAuditId);
    }
  }, [resumeAuditId]);

  useEffect(() => {
    stepRestoredForAuditIdRef.current = null;
    lastRestoredAtRef.current = null;
  }, [currentAuditId]);

  /* ── Restore full state when audit data loads (resume from sidebar) ── */
  useEffect(() => {
    if (!auditData || !currentAuditId) return;
    const updatedAt = (auditData as any).updatedAt as string | undefined;
    if (updatedAt && lastRestoredAtRef.current === updatedAt) return; // already restored this version
    if (updatedAt) lastRestoredAtRef.current = updatedAt;
    setProjectName((auditData.projectName as string) || auditData.productName || "");
    setBrandName((auditData.brandName as string) || "");
    setProductName(auditData.productName || "");
    setCategory((auditData.category as string) || "");
    setUploadedImages((auditData.imageUrls as string[]) || []);
    if (auditData.generatedContent) {
      setGeneratedContent(auditData.generatedContent as any);
    }
    // Restore graphics selections from saved payload only
    if ((auditData as any).selectedImageTypes && Array.isArray((auditData as any).selectedImageTypes)) {
      setSelectedImageTypes((auditData as any).selectedImageTypes as string[]);
    }
    // Restore generated images from imageRecords
    if (auditData.imageRecords && (auditData.imageRecords as any[]).length > 0) {
      const records = auditData.imageRecords as any[];
      setGeneratedImages(records.filter((r) => r.currentUrl).map((r) => ({
        url: r.currentUrl, type: r.type || "lifestyle", index: r.index ?? 0,
      })));
    }
    const savedAplus = readAplusFromAudit(auditData.generatedImages);
    if (savedAplus.content) setAplusContent(savedAplus.content);
    if (savedAplus.modules.length) setAplusModules(savedAplus.modules);
    if (savedAplus.status === "generating") {
      setAplusStatus("generating");
      setAplusProgress(savedAplus.progress);
      setIsCreating(true);
      setCreatingStep(4);
      setActiveStep(4);
    } else {
      setAplusStatus(savedAplus.status === "failed" ? "failed" : savedAplus.modules.length ? "completed" : "idle");
      setAplusProgress(savedAplus.progress);
      if (stepRestoredForAuditIdRef.current !== currentAuditId) {
        const step = (auditData.currentStep || 1) as StepId;
        if (step >= 1 && step <= 5) setActiveStep(step);
        stepRestoredForAuditIdRef.current = currentAuditId;
      }
    }
    setIsDirty(false);
  }, [auditData, currentAuditId]);

  /* ── Graphics step state ── */
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt]             = useState("");


  /* ── Close category dropdown on outside click ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = catRef.current?.contains(target);
      const inPortal  = (target as Element)?.closest?.("[data-cat-portal]");
      if (!inTrigger && !inPortal) setCatOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Graphics generation state (inline in workflow) ── */
  const [graphicsProjectId, setGraphicsProjectId] = useState<number | null>(null);
  const [graphicsStatus, setGraphicsStatus] = useState<string>("idle");
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; type: string; index: number }>>([]);
  const [graphicsProgress, setGraphicsProgress] = useState({ generated: 0, total: 0 });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const completionToastShownRef = useRef(false);
  const hasSeenGeneratingRef = useRef(false);

  /* ── A+ Content step state ── */
  const [selectedAplusModules, setSelectedAplusModules] = useState<AplusModuleId[]>([]);
  const [aplusContent, setAplusContent] = useState<AplusContent | null>(null);
  const [aplusModules, setAplusModules] = useState<AplusModule[]>([]);
  const [aplusStatus, setAplusStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [aplusProgress, setAplusProgress] = useState({ done: 0, total: 4 });
  const aplusCompletionToastShownRef = useRef(false);
  const generateAplus = useMutation({
    mutationFn: async ({ auditId, moduleIds }: { auditId: number; moduleIds: AplusModuleId[] }) => {
      const res = await fetch(`${basePath}/api/audits/${auditId}/generate-aplus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ moduleIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatAplusApiError(res.status, (err as { error?: string }).error));
      }
      if (res.status === 202) {
        return { started: true as const };
      }
      return res.json() as Promise<{ content: AplusContent; modules: AplusModule[] }>;
    },
    onSuccess: (data) => {
      if ("started" in data && data.started) {
        setAplusStatus("generating");
        setAplusProgress({ done: 0, total: 4 });
        aplusCompletionToastShownRef.current = false;
        refreshCreditBalances(queryClient);
        if (currentAuditId) {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(currentAuditId) });
        }
        return;
      }
      if ("content" in data) {
        setAplusContent(data.content);
        setAplusModules(data.modules);
        setAplusStatus("completed");
        setIsCreating(false);
        refreshCreditBalances(queryClient);
        toast({ title: "A+ content generated!", description: "Copy and module images are ready." });
        if (currentAuditId) {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(currentAuditId) });
        }
      }
    },
    onError: (err) => {
      setIsCreating(false);
      setAplusStatus("failed");
      toast({
        title: "A+ generation failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  /* ── Poll A+ generation status via audit record ── */
  useEffect(() => {
    if (!currentAuditId || aplusStatus !== "generating") return;

    const poll = async () => {
      try {
        const res = await fetch(`${basePath}/api/audits/${currentAuditId}`, { credentials: "include" });
        if (!res.ok) return;
        const audit = await res.json() as { generatedImages?: unknown };
        const aplus = readAplusFromAudit(audit.generatedImages);

        if (aplus.content) setAplusContent(aplus.content);
        if (aplus.modules.length) setAplusModules(aplus.modules);
        setAplusProgress(aplus.progress);

        if (aplus.status === "generating") return;

        setAplusStatus(aplus.status === "failed" ? "failed" : "completed");
        setIsCreating(false);

        if (aplus.status === "completed" && !aplusCompletionToastShownRef.current) {
          aplusCompletionToastShownRef.current = true;
          refreshCreditBalances(queryClient);
          toast({ title: "A+ content generated!", description: `${aplus.modules.length} module images are ready.` });
        } else if (aplus.status === "failed") {
          toast({
            title: "A+ generation failed",
            description: aplus.errorMessage ?? "Please try again",
            variant: "destructive",
          });
        }
      } catch {
        // keep polling
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 2500);
    return () => clearInterval(interval);
  }, [currentAuditId, aplusStatus, queryClient, toast]);

  /* ── Fetch existing graphics project for this audit ── */
  const { data: existingGraphicsProject } = useQuery({
    queryKey: ["graphics-project-for-audit", currentAuditId],
    queryFn: async () => {
      if (!currentAuditId) return null;
      const res = await fetch(`${basePath}/api/graphics/projects?auditId=${currentAuditId}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json() as { projects?: Array<{ id: number }> };
      return data.projects?.[0] ?? null;
    },
    enabled: !!currentAuditId,
    staleTime: 5 * 60 * 1000,
  });

  /* ── Generate on existing project ── */
  const generateExisting = useMutation({
    mutationFn: async ({ projectId, imageTypes, customPrompt }: { projectId: number; imageTypes: string[]; customPrompt?: string }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageTypes, customPrompt: customPrompt?.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      refreshCreditBalances(queryClient);
      setGraphicsProjectId(variables.projectId);
      setGraphicsStatus("generating");
      completionToastShownRef.current = false;
      hasSeenGeneratingRef.current = false;
      // Keep existing images visible during generation
      setGraphicsProgress({ generated: 0, total: variables.imageTypes.length });
    },
    onError: (err) => {
      setIsCreating(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    },
  });

  /* ── Graphics project mutation ── */
  const createProject = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`${basePath}/api/graphics/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (project: { id: number; lifestyleCount?: number; featureCount?: number }) => {
      void fetch(`${basePath}/api/graphics/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageTypes: selectedImageTypes, customPrompt: customPrompt.trim() || undefined }),
      }).then(() => refreshCreditBalances(queryClient));
      setGraphicsProjectId(project.id);
      setGraphicsStatus("generating");
      completionToastShownRef.current = false;
      hasSeenGeneratingRef.current = false;
      // Keep existing images visible during generation
      setGraphicsProgress({ generated: 0, total: selectedImageTypes.length });
      /* Stay in workflow — no nav() away */
    },
    onError: (err) => {
      setIsCreating(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    },
  });

  /* ── Poll graphics project status ── */
  useEffect(() => {
    const activeGraphicsProjectId = graphicsProjectId ?? existingGraphicsProject?.id ?? null;
    if (!activeGraphicsProjectId || graphicsStatus === "completed" || graphicsStatus === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(`${basePath}/api/graphics/projects/${activeGraphicsProjectId}`, { credentials: "include" });
        if (!res.ok) return;
        const project = await res.json() as {
          status: string;
          generatedCount: number;
          lifestyleCount: number;
          featureCount: number;
          imageRecords?: Array<{ currentUrl?: string; type?: string; index?: number }>;
          errorMessage?: string | null;
        };
        setGraphicsStatus(project.status);
        if (project.status === "generating") {
          hasSeenGeneratingRef.current = true;
        }
        const total = (project.lifestyleCount ?? 0) + (project.featureCount ?? 0);
        setGraphicsProgress({ generated: project.generatedCount ?? 0, total });
        if (project.imageRecords) {
          const imageRecords = project.imageRecords;
          setGeneratedImages((prev) => {
            const newImages = imageRecords
              .filter((r) => r.currentUrl)
              .map((r) => ({ url: r.currentUrl!, type: r.type ?? "lifestyle", index: r.index ?? 0 }));
            // Merge: keep existing, add new ones keyed by url+type+index
            const existingKeys = new Set(prev.map((i) => `${i.url}|${i.type}|${i.index}`));
            const merged = [...prev];
            for (const img of newImages) {
              const key = `${img.url}|${img.type}|${img.index}`;
              if (!existingKeys.has(key)) {
                merged.push(img);
                existingKeys.add(key);
              }
            }
            return merged;
          });
        }
        if (project.status === "completed") {
          setIsCreating(false);
          refreshCreditBalances(queryClient);
          if (hasSeenGeneratingRef.current && !completionToastShownRef.current) {
            completionToastShownRef.current = true;
            toast({ title: "Graphics ready!", description: `${total} images generated successfully.` });
          }
          // Persist completed graphics directly from poll data (avoids stale state)
          if (currentAuditId && project.imageRecords) {
            const imageRecords = project.imageRecords
              .filter((r) => r.currentUrl)
              .map((r) => ({
                id: `${r.type ?? "lifestyle"}_${r.index ?? 0}`,
                type: (r.type === "feature" ? "infographic" : "lifestyle") as "main" | "infographic" | "lifestyle",
                index: r.index ?? 0,
                style: "modern",
                aspectRatio: "1:1",
                currentUrl: r.currentUrl!,
                versions: [],
              }));
            patchAudit.mutate(
              { id: currentAuditId, data: { currentStep: activeStep, imageRecords } },
              { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(currentAuditId) }) }
            );
          }
        }
        if (project.status === "failed") {
          setIsCreating(false);
          toast({ title: "Generation failed", description: project.errorMessage || "Something went wrong", variant: "destructive" });
        }
      } catch { /* ignore poll errors */ }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [graphicsProjectId, existingGraphicsProject, graphicsStatus, toast, queryClient, currentAuditId, activeStep, patchAudit]);

  /* ── File upload helpers ── */
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const rawFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (rawFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please upload image files only", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    const results: string[] = [];
    let checked = 0;
    rawFiles.forEach((file) => {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Too large", description: `"${file.name}" exceeds 20 MB`, variant: "destructive" });
        checked++;
        if (checked === rawFiles.length) { setUploadedImages((p) => [...p, ...results]); setIsUploading(false); }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result as string);
        checked++;
        if (checked === rawFiles.length) { setUploadedImages((p) => [...p, ...results]); setIsUploading(false); }
      };
      reader.onerror = () => {
        checked++;
        if (checked === rawFiles.length) { setUploadedImages((p) => [...p, ...results]); setIsUploading(false); }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Execute create for current step ── */
  const handleCreate = useCallback(() => {
    setCreatingStep(activeStep);
    setIsCreating(true);

    if (activeStep === 1) {
      // Step 1: Create audit immediately with all available info
      if (!productName.trim()) {
        setIsCreating(false);
        toast({ title: "Product name required", description: "Please enter a product name.", variant: "destructive" });
        return;
      }
      if (!category) {
        setIsCreating(false);
        toast({ title: "Category required", description: "Please select a category.", variant: "destructive" });
        return;
      }
      const syntheticTitle = brandName.trim()
        ? `${brandName.trim()} ${productName.trim()} — ${category}`
        : `${productName.trim()} — ${category}`;
      const syntheticBullets = [
        `High-quality ${productName.trim().toLowerCase()} designed for everyday use`,
        `Perfect for ${category.toLowerCase()} enthusiasts and professionals`,
        `Durable, reliable, and built to last`,
        `Easy to use and maintain — great value for money`,
        `Premium quality backed by customer satisfaction`,
      ];
      const syntheticKeywords = productName.trim().split(/\s+/).filter((w) => w.length > 2);
      if (category) {
        syntheticKeywords.push(...category.split(/\s+/).filter((w) => w.length > 2));
      }
      const filler = [
        "premium", "best seller", "top rated", "quality", "durable", "reliable", "easy", "value",
        "professional", "home", "gift", "essential", "popular", "recommended", "trusted",
      ];
      while (syntheticKeywords.length < 10 && filler.length > 0) {
        syntheticKeywords.push(filler.shift()!);
      }
      createAudit.mutate(
        {
          data: {
            projectName: projectName.trim() || productName.trim(),
            productName: productName.trim(),
            brandName: brandName.trim() || undefined,
            category: category || undefined,
            title: syntheticTitle,
            bulletPoints: syntheticBullets,
            targetKeywords: syntheticKeywords.slice(0, 10),
            imageUrls: uploadedImages,
          },
        },
        {
          onSuccess: (audit) => {
            setIsCreating(false);
            setCurrentAuditId(audit.id);
            toast({ title: "Project created!", description: `Saved as "${audit.projectName || audit.productName}"` });
            setActiveStep(2);
            queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
            void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey() });
            refreshCreditBalances(queryClient);
          },
          onError: (err) => {
            setIsCreating(false);
            toast({ title: "Failed to create project", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
          },
        }
      );

    } else if (activeStep === 2) {
      // Listing: generate content directly (no audit)
      if (!productName.trim()) {
        setIsCreating(false);
        toast({ title: "Product name required", description: "Please enter a product name in Step 1 first.", variant: "destructive" });
        return;
      }
      if (!category) {
        setIsCreating(false);
        toast({ title: "Category required", description: "Please select a category in Step 1 first.", variant: "destructive" });
        return;
      }
      const syntheticTitle = brandName.trim()
        ? `${brandName.trim()} ${productName.trim()} — ${category}`
        : `${productName.trim()} — ${category}`;
      const syntheticBullets = [
        `High-quality ${productName.trim().toLowerCase()} designed for everyday use`,
        `Perfect for ${category.toLowerCase()} enthusiasts and professionals`,
        `Durable, reliable, and built to last`,
        `Easy to use and maintain — great value for money`,
        `Premium quality backed by customer satisfaction`,
      ];
      const syntheticKeywords = productName.trim().split(/\s+/).filter((w) => w.length > 2);
      if (category) {
        syntheticKeywords.push(...category.split(/\s+/).filter((w) => w.length > 2));
      }
      const filler = [
        "premium", "best seller", "top rated", "quality", "durable", "reliable", "easy", "value",
        "professional", "home", "gift", "essential", "popular", "recommended", "trusted",
      ];
      while (syntheticKeywords.length < 10 && filler.length > 0) {
        syntheticKeywords.push(filler.shift()!);
      }
      generateContentDirect.mutate(
        {
          data: {
            productName: productName.trim(),
            brandName: brandName.trim() || undefined,
            category: category || undefined,
            title: syntheticTitle,
            bulletPoints: syntheticBullets,
            targetKeywords: syntheticKeywords.slice(0, 10),
            imageUrls: uploadedImages,
          },
        },
        {
          onSuccess: (data) => {
            setIsCreating(false);
            setGeneratedContent(data);
            toast({ title: "Listing content ready!", description: "Your optimized content is ready." });
            refreshCreditBalances(queryClient);
          },
          onError: (err) => {
            setIsCreating(false);
            toast({ title: "Failed", description: err instanceof Error ? err.message : "Content generation failed", variant: "destructive" });
          },
        }
      );

    } else if (activeStep === 3) {
      // Graphics
      if (selectedImageTypes.length === 0) {
        setIsCreating(false);
        toast({ title: "Select image types", description: "Please select at least one image type.", variant: "destructive" });
        return;
      }
      // Reuse existing graphics project for this audit, or create new one
      if (existingGraphicsProject?.id) {
        generateExisting.mutate({
          projectId: existingGraphicsProject.id,
          imageTypes: selectedImageTypes,
          customPrompt: customPrompt.trim() || undefined,
        });
      } else {
        createProject.mutate({
          name: `${productName || "Product"}`,
          productName: productName || "Product",
          category,
          sourceImageUrls: uploadedImages,
          imageTypes: selectedImageTypes,
          customPrompt: customPrompt.trim() || undefined,
          auditId: currentAuditId ?? undefined,
        });
      }

    } else if (activeStep === 5) {
      // Export: simulate
      setTimeout(() => {
        setIsCreating(false);
        toast({ title: "Export ready!", description: "Coming soon — this feature is launching shortly." });
      }, 3000);
    }
  }, [activeStep, selectedImageTypes, productName, category, uploadedImages, customPrompt, brandName, createAudit, createProject, generateExisting, existingGraphicsProject, queryClient, nav, toast]);

  const handleGenerateAplus = useCallback(() => {
    if (!currentAuditId) {
      toast({ title: "Save project first", description: "Complete Step 1 to create your project before generating A+ content.", variant: "destructive" });
      return;
    }
    if (!productName.trim()) {
      toast({ title: "Product name required", description: "Please enter a product name in Step 1 first.", variant: "destructive" });
      return;
    }
    if (selectedAplusModules.length === 0) {
      toast({ title: "Select modules", description: "Choose at least one A+ module to generate.", variant: "destructive" });
      return;
    }
    setCreatingStep(4);
    setActiveStep(4);
    setIsCreating(true);
    patchAudit.mutate({ id: currentAuditId, data: { currentStep: 4 } });
    generateAplus.mutate({
      auditId: currentAuditId,
      moduleIds: selectedAplusModules,
    });
  }, [currentAuditId, productName, selectedAplusModules, generateAplus, patchAudit, toast]);

  /* ── Auto-save helper ── */
  const autoSave = useCallback((step: StepId) => {
    if (!currentAuditId) return;
    const payload: Record<string, unknown> = { currentStep: step };
    if (projectName) payload.projectName = projectName;
    if (brandName) payload.brandName = brandName;
    if (productName) payload.productName = productName;
    if (category) payload.category = category;
    if (uploadedImages.length) payload.imageUrls = uploadedImages;
    if (generatedContent) payload.generatedContent = generatedContent;
    if (selectedImageTypes.length) payload.selectedImageTypes = selectedImageTypes;
    // Persist generated images via imageRecords — only if there are real URLs
    if (generatedImages.length > 0 && generatedImages.some((img) => img.url)) {
      payload.imageRecords = generatedImages
        .filter((img) => img.url)
        .map((img, i) => ({
          id: `${img.type}_${img.index ?? i}`,
          type: img.type === "infographic" ? "infographic" : "lifestyle",
          index: img.index ?? i,
          style: "modern",
          aspectRatio: "1:1",
          currentUrl: img.url,
          versions: [],
        }));
    }
    patchAudit.mutate(
      { id: currentAuditId, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(currentAuditId) });
        },
      }
    );
    setIsDirty(false);
  }, [currentAuditId, projectName, brandName, productName, category, uploadedImages, generatedContent, generatedImages, selectedImageTypes, patchAudit, queryClient]);

  /* ── Explicit save (same step, no navigation) ── */
  const handleSave = useCallback(() => {
    autoSave(activeStep);
  }, [autoSave, activeStep]);

  /* ── Bottom bar ── */
  function handleBack() {
    if (activeStep === 1) nav("/audits/new");
    else {
      autoSave((activeStep - 1) as StepId);
      setActiveStep((s) => (s - 1) as StepId);
    }
  }

  /* ── Next step ── */
  function handleNextStep() {
    if (activeStep === 1) {
      // Step 1: always requires product name + category
      if (!productName.trim()) {
        toast({ title: "Product name required", description: "Please enter a product name before continuing.", variant: "destructive" });
        return;
      }
      if (!category) {
        toast({ title: "Category required", description: "Please select a category before continuing.", variant: "destructive" });
        return;
      }
      if (currentAuditId === null) {
        // No audit yet — create it (handleCreate advances to step 2 on success)
        handleCreate();
        return;
      }
    }
    if (activeStep < 5) {
      autoSave((activeStep + 1) as StepId);
      setActiveStep((s) => (s + 1) as StepId);
    }
  }

  const filteredCats = AMAZON_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(catSearch.toLowerCase())
  );

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Top Progress Stepper ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-0 flex-shrink-0">
        <div className="flex items-stretch max-w-5xl mx-auto">
          {STEPS.map((s) => {
            const isActive    = activeStep === s.id;
            const isCompleted = activeStep > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={cn(
                  "flex-1 flex flex-col items-center py-4 gap-1 border-b-2 transition-all text-center",
                  isActive ? "border-orange-500" : "border-transparent hover:border-slate-200"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                  isCompleted ? "bg-orange-500 border-orange-500 text-white"
                  : isActive  ? "bg-orange-500 border-orange-500 text-white"
                             : "bg-white border-slate-300 text-slate-400"
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <p className={cn("text-[10px] font-bold uppercase tracking-wider leading-none",
                  isActive ? "text-orange-500" : isCompleted ? "text-orange-400" : "text-slate-400"
                )}>
                  {s.label}
                </p>
                <p className={cn("text-[10px] leading-tight hidden sm:block",
                  isActive || isCompleted ? "text-slate-600" : "text-slate-400"
                )}>
                  {s.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content area (relative for panel positioning) ─────────────────── */}
      <div className="flex-1 overflow-y-auto relative">

        {/* Loading panel */}
        {isCreating && (
          <CreatingPanel
            stepId={creatingStep}
            onCancel={() => setIsCreating(false)}
          />
        )}

        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* STEP 1: Upload ── */}
          {activeStep === 1 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Upload Product Images</h2>
                  <p className="text-sm text-slate-500">Add high-quality images to showcase your product in the best way</p>
                </div>
              </div>

              {/* Two-column: upload zone + preview */}
              <div className="border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: upload zone */}
                <div
                  className="border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/20 p-6 flex flex-col items-center gap-3 cursor-pointer hover:bg-orange-50/40 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                >
                  <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-orange-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">Drag or upload product images</p>
                    <p className="text-xs text-slate-400 mt-0.5">PNG, JPG up to 20MB each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors w-full justify-center"
                  >
                    <Monitor className="w-4 h-4" />
                    Upload from device
                  </button>
                  <span className="text-xs text-slate-400">or</span>
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors w-full justify-center"
                  >
                    <Camera className="w-4 h-4 text-orange-400" />
                    Use camera
                  </button>
                  <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 w-full">
                    <Lightbulb className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-600">Tip: Use high-quality images with good lighting for better results.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </div>

                {/* Right: uploaded images preview */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      Uploaded Images ({uploadedImages.length}/10)
                    </span>
                    {uploadedImages.length > 0 && (
                      <button
                        className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                        onClick={() => setUploadedImages([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {uploadedImages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-300 text-sm border-2 border-dashed border-slate-100 rounded-xl py-10">
                      No images yet
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        {uploadedImages.slice(0, 8).map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-white">
                            <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full shadow flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                              onClick={() => setUploadedImages((p) => p.filter((_, i) => i !== idx))}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="mt-auto w-full flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-2.5 text-sm text-orange-500 hover:bg-orange-50 font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add more images
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Product Details</p>
                    <p className="text-xs text-slate-400">Provide basic information about your product</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Project Name</label>
                  <Input
                    value={projectName}
                    onChange={(e) => { setProjectName(e.target.value); if (currentAuditId) setIsDirty(true); }}
                    placeholder="e.g. Summer Launch 2025"
                    className="border-slate-200 rounded-xl h-11"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Brand Name</label>
                    <Input
                      value={brandName}
                      onChange={(e) => { setBrandName(e.target.value); if (currentAuditId) setIsDirty(true); }}
                      placeholder="e.g. Acme Co."
                      className="border-slate-200 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Product Name <span className="text-red-500">*</span></label>
                    <Input
                      value={productName}
                      onChange={(e) => { setProductName(e.target.value); if (currentAuditId) setIsDirty(true); }}
                      placeholder="Enter product name"
                      className="border-slate-200 rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5" ref={catRef}>
                  <label className="text-sm font-medium text-slate-700">Select Category</label>
                  <div className="relative">
                    <button
                      ref={catBtnRef}
                      type="button"
                      onClick={() => {
                        const rect = catBtnRef.current?.getBoundingClientRect();
                        if (rect) {
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const portalHeight = Math.min(420, window.innerHeight * 0.6);
                          const placeAbove = spaceBelow < portalHeight + 8 && rect.top > portalHeight + 8;
                          setCatPos({
                            top: placeAbove ? rect.top - portalHeight - 4 : rect.bottom + 4,
                            left: rect.left,
                            width: rect.width,
                          });
                        }
                        setCatOpen((o) => !o);
                      }}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 text-left flex items-center"
                    >
                      <span className={category ? "text-slate-900" : "text-slate-400"}>
                        {category || "Search or select category"}
                      </span>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {catOpen && createPortal(
                      <CategoryPortalDropdown
                        catPos={catPos}
                        catSearch={catSearch}
                        setCatSearch={setCatSearch}
                        filteredCats={filteredCats}
                        category={category}
                        setCategory={(v) => { setCategory(v); if (currentAuditId) setIsDirty(true); }}
                        setCatOpen={setCatOpen}
                      />,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Listing ── */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Create Listing Content</h2>
                  <p className="text-sm text-slate-500">AI will generate optimized content based on your product images and details</p>
                </div>
              </div>

              {/* What gets generated */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <p className="text-sm font-medium text-slate-700">What will be generated</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["Product Title", "Bullet Points", "Keywords", "Description"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-orange-500" />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-900">AI-Powered Optimization</p>
                  <p className="text-sm text-orange-700 mt-1">Our AI generates compelling titles, bullet points, keywords, and descriptions optimized for Amazon search and conversions.</p>
                </div>
              </div>

              {/* Generate button — no ASIN required */}
              <button
                type="button"
                onClick={() => {
                  if (!productName.trim()) {
                    toast({ title: "Product name required", description: "Please enter a product name in Step 1 first.", variant: "destructive" });
                    return;
                  }
                  if (!category) {
                    toast({ title: "Category required", description: "Please select a category in Step 1 first.", variant: "destructive" });
                    return;
                  }
                  setCreatingStep(2);
                  setIsCreating(true);

                  if (currentAuditId) {
                    // Already have an audit: just regenerate content
                    generateContent.mutate(
                      { id: currentAuditId },
                      {
                        onSuccess: (data) => {
                          setIsCreating(false);
                          setGeneratedContent(data);
                          toast({ title: "Listing content regenerated!", description: "Your optimized content is ready." });
                          refreshCreditBalances(queryClient);
                        },
                        onError: (err) => {
                          setIsCreating(false);
                          toast({ title: "Failed", description: err instanceof Error ? err.message : "Content generation failed", variant: "destructive" });
                        },
                      }
                    );
                    return;
                  }

                  // Build synthetic listing from user inputs + images
                  const syntheticTitle = brandName.trim()
                    ? `${brandName.trim()} ${productName.trim()} — ${category}`
                    : `${productName.trim()} — ${category}`;
                  const syntheticBullets = [
                    `High-quality ${productName.trim().toLowerCase()} designed for everyday use`,
                    `Perfect for ${category.toLowerCase()} enthusiasts and professionals`,
                    `Durable, reliable, and built to last`,
                    `Easy to use and maintain — great value for money`,
                    `Premium quality backed by customer satisfaction`,
                  ];
                  const syntheticKeywords = productName.trim().split(/\s+/).filter((w) => w.length > 2);
                  if (category) {
                    syntheticKeywords.push(...category.split(/\s+/).filter((w) => w.length > 2));
                  }
                  // Ensure at least 10 keywords
                  const filler = [
                    "premium", "best seller", "top rated", "quality", "durable", "reliable", "easy", "value",
                    "professional", "home", "gift", "essential", "popular", "recommended", "trusted",
                  ];
                  while (syntheticKeywords.length < 10 && filler.length > 0) {
                    syntheticKeywords.push(filler.shift()!);
                  }

                  generateContentDirect.mutate(
                    {
                      data: {
                        productName: productName.trim(),
                        brandName: brandName.trim() || undefined,
                        category: category || undefined,
                        title: syntheticTitle,
                        bulletPoints: syntheticBullets,
                        targetKeywords: syntheticKeywords.slice(0, 10),
                        imageUrls: uploadedImages,
                      },
                    },
                    {
                      onSuccess: (data) => {
                        setIsCreating(false);
                        setGeneratedContent(data);
                        toast({ title: "Listing content ready!", description: "Your optimized content is ready." });
                        refreshCreditBalances(queryClient);
                      },
                      onError: (err) => {
                        setIsCreating(false);
                        toast({ title: "Failed", description: err instanceof Error ? err.message : "Content generation failed", variant: "destructive" });
                      },
                    }
                  );
                }}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-orange-200"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generatedContent ? "Regenerate Content" : "Generate Listing Content"}
              </button>

              {/* Display generated content */}
              {generatedContent && (
                <div className="bg-white border border-orange-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-orange-50 border-b border-orange-100 px-6 py-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-semibold text-orange-900">Generated Content</p>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Title */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Product Title</p>
                      <p className="text-sm text-slate-900 font-medium">{generatedContent.title}</p>
                    </div>
                    {/* Bullet Points */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Bullet Points</p>
                      <ul className="space-y-1.5">
                        {generatedContent.bulletPoints.map((b, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Keywords */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {generatedContent.keywords.map((k, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100">{k}</span>
                        ))}
                      </div>
                    </div>
                    {/* Description */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedContent.htmlDescription);
                              toast({ title: "Copied", description: "HTML description copied to clipboard." });
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            title="Copy HTML"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                            <button
                              onClick={() => setDescViewMode("preview")}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                                descViewMode === "preview" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-500"
                              )}
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                            <button
                              onClick={() => setDescViewMode("code")}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                                descViewMode === "code" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-500"
                              )}
                            >
                              <Code2 className="w-3 h-3" /> Code
                            </button>
                          </div>
                        </div>
                      </div>
                      {descViewMode === "preview" ? (
                        <div
                          className="prose prose-sm max-w-none text-foreground/90 border rounded-md p-4 bg-muted/20"
                          dangerouslySetInnerHTML={{ __html: generatedContent.htmlDescription }}
                        />
                      ) : (
                        <pre className="text-xs text-slate-700 leading-relaxed border rounded-md p-3 bg-slate-900 text-slate-100 overflow-x-auto whitespace-pre-wrap font-mono">{generatedContent.htmlDescription}</pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Graphics ── */}
          {activeStep === 3 && (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Wand2 className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Create Product Graphics</h2>
                  <p className="text-base text-slate-500 mt-0.5">Choose the image types you want to generate</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {IMAGE_TYPES.map((type) => {
                  const isSelected = selectedImageTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedImageTypes((prev) =>
                          prev.includes(type.id) ? prev.filter((s) => s !== type.id) : [...prev, type.id]
                        );
                        if (currentAuditId) setIsDirty(true);
                      }}
                      className={cn(
                        "relative rounded-2xl border-2 p-5 text-left transition-all",
                        isSelected ? "border-orange-500 bg-orange-50/40 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      )}
                    >
                      <span className="text-3xl leading-none block mb-3">{type.icon}</span>
                      <p className={cn("text-base font-semibold", isSelected ? "text-orange-900" : "text-slate-900")}>
                        {type.label}
                      </p>
                      <p className="text-sm text-slate-400 mt-1 leading-snug">{type.desc}</p>
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedImageTypes.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 font-semibold text-sm">
                    {selectedImageTypes.length} selected
                  </span>
                  <span className="text-base text-slate-400">~{selectedImageTypes.length * 30}s total</span>
                </div>
              )}

              {selectedImageTypes.includes("custom") && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5 space-y-3">
                  <label className="text-base font-medium text-orange-900">Custom Prompt</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => { setCustomPrompt(e.target.value); setIsDirty(true); }}
                    placeholder="Describe exactly what you want the AI to create..."
                    rows={4}
                    className="w-full resize-none text-base border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              )}

              {/* Generate Graphics button */}
              <Button
                size="lg"
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2.5 shadow-lg shadow-orange-500/20 text-base font-semibold"
                disabled={isCreating || selectedImageTypes.length === 0 || graphicsStatus === "generating"}
                onClick={handleCreate}
              >
                {isCreating || graphicsStatus === "generating" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate {selectedImageTypes.length > 0 ? `${selectedImageTypes.length} Image${selectedImageTypes.length > 1 ? "s" : ""}` : "Graphics"}
                  </>
                )}
              </Button>

              {/* Inline progress */}
              {graphicsStatus === "generating" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-slate-600 font-medium">
                      Generating {graphicsProgress.total} image{graphicsProgress.total > 1 ? "s" : ""}…
                    </span>
                    <span className="text-orange-600 font-semibold">
                      {graphicsProgress.generated} / {graphicsProgress.total}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${graphicsProgress.total > 0 ? (graphicsProgress.generated / graphicsProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Generated images grid */}
              {generatedImages.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">
                      Generated Images ({generatedImages.length})
                    </h3>
                    {graphicsStatus === "completed" && (
                      <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
                        <Check className="w-4 h-4" /> Complete
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {generatedImages.map((img, i) => (
                      <button
                        key={`${img.url}-${i}`}
                        className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden hover:border-orange-300 hover:shadow-md transition-all group"
                        onClick={() => setLightboxImage(img.url)}
                      >
                        <img
                          src={img.url}
                          alt={`Generated ${img.type} ${img.index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/50 text-white text-[10px] font-medium uppercase tracking-wider">
                          {img.type}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <Eye className="w-4 h-4 text-slate-700" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: A+ Content ── */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Create A+ Content</h2>
                  <p className="text-sm text-slate-500">Generate professional A+ content modules to boost conversions</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium text-slate-700">Choose modules to generate</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-orange-600 hover:text-orange-700"
                    onClick={() => setSelectedAplusModules([...ALL_APLUS_MODULE_IDS])}
                    disabled={aplusStatus === "generating" || generateAplus.isPending}
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    onClick={() => setSelectedAplusModules([])}
                    disabled={aplusStatus === "generating" || generateAplus.isPending}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {APLUS_MODULE_CARDS.map((module) => {
                  const isSelected = selectedAplusModules.includes(module.id);
                  const generated = aplusModules.find((m) => m.id === module.id);
                  const ModuleIcon = module.icon;
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => {
                        setSelectedAplusModules((prev) =>
                          prev.includes(module.id)
                            ? prev.filter((id) => id !== module.id)
                            : [...prev, module.id],
                        );
                        setIsDirty(true);
                      }}
                      disabled={aplusStatus === "generating" || generateAplus.isPending}
                      className={cn(
                        "relative rounded-2xl border-2 p-5 text-left transition-all",
                        isSelected
                          ? "border-orange-500 bg-orange-50/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors",
                          isSelected ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        <ModuleIcon className="w-5 h-5" strokeWidth={2} />
                      </div>
                      <p className={cn("text-base font-semibold", isSelected ? "text-orange-900" : "text-slate-900")}>
                        {module.title}
                      </p>
                      <p className="text-sm text-slate-400 mt-1 leading-snug">{module.desc}</p>
                      {generated && (
                        <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Already generated
                        </p>
                      )}
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedAplusModules.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 font-semibold text-sm">
                    {selectedAplusModules.length} selected
                  </span>
                  <span className="text-sm text-slate-400">
                    {selectedAplusModules.length === ALL_APLUS_MODULE_IDS.length
                      ? "All modules will be generated"
                      : `${selectedAplusModules.length} module${selectedAplusModules.length > 1 ? "s" : ""} will be generated`}
                  </span>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2.5 shadow-lg shadow-orange-500/20 text-base font-semibold"
                disabled={isCreating || generateAplus.isPending || aplusStatus === "generating" || !currentAuditId || selectedAplusModules.length === 0}
                onClick={handleGenerateAplus}
              >
                {isCreating || generateAplus.isPending || aplusStatus === "generating" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating A+ Content…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {selectedAplusModules.length > 0
                      ? `Generate ${selectedAplusModules.length} A+ Module${selectedAplusModules.length > 1 ? "s" : ""}`
                      : "Generate A+ Content"}
                  </>
                )}
              </Button>

              {aplusStatus === "generating" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-slate-600 font-medium">
                      Generating {aplusProgress.total} A+ module image{aplusProgress.total > 1 ? "s" : ""}…
                    </span>
                    <span className="text-orange-600 font-semibold">
                      {aplusProgress.done} / {aplusProgress.total}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${aplusProgress.total > 0 ? (aplusProgress.done / aplusProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">This can take a few minutes. Keep this page open while images finish.</p>
                </div>
              )}

              {!currentAuditId && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  Complete Step 1 and save your project before generating A+ content.
                </p>
              )}

              {aplusModules.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">
                      Generated A+ Modules ({aplusModules.length})
                    </h3>
                    <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Complete
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {aplusModules.map((module) => (
                      <div
                        key={module.id}
                        className="border border-slate-200 rounded-xl overflow-hidden hover:border-orange-300 hover:shadow-sm transition-all bg-white"
                      >
                        <button
                          type="button"
                          className="relative w-full aspect-[16/10] bg-slate-100 group"
                          onClick={() => setLightboxImage(module.imageUrl)}
                        >
                          <img
                            src={module.imageUrl}
                            alt={module.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/50 text-white text-[10px] font-medium uppercase tracking-wider">
                            {module.title}
                          </div>
                        </button>
                        <div className="p-4 space-y-1">
                          <p className="text-sm font-semibold text-slate-800">{module.headline}</p>
                          <p className="text-xs text-slate-500 line-clamp-2">{module.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-sm font-semibold text-amber-900">✦ A+ Content requires Brand Registry</p>
                <p className="text-sm text-amber-700 mt-1">Ensure your brand is enrolled in Amazon Brand Registry before publishing A+ Content modules.</p>
              </div>
            </div>
          )}

          {/* STEP 5: Export ── */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Download className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Export & Publish</h2>
                  <p className="text-sm text-slate-500">Download your assets or publish directly to your store</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: "📊", title: "Export as Excel file", desc: "Amazon supports Excel file uploads for bulk listings", action: "Download Excel", comingSoon: false },
                  { icon: "🗂️", title: "Export as ZIP",        desc: "Excel file + all images bundled together",           action: "Download ZIP",   comingSoon: false },
                  { icon: "🛒", title: "Publish to Amazon",    desc: "Push directly to Seller Central",                      action: "Coming soon",    comingSoon: true  },
                ].map((opt) => (
                  <div key={opt.title} className={cn("border border-slate-200 rounded-xl p-5 flex flex-col gap-4 transition-all", opt.comingSoon ? "opacity-60" : "hover:border-orange-300 hover:shadow-sm")}>
                    <span className="text-3xl">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{opt.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      className={cn("rounded-xl w-full", opt.comingSoon
                        ? "border-slate-200 text-slate-400 cursor-default hover:bg-transparent"
                        : "border-orange-200 text-orange-600 hover:bg-orange-50"
                      )}
                      onClick={() => {
                        if (opt.comingSoon) return;
                        toast({ title: "Coming soon", description: `${opt.action} is coming soon.` });
                      }}
                    >
                      {opt.action}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Bottom Bar ───────────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Button
          variant="outline"
          className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
          onClick={handleBack}
          disabled={isCreating}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {/* Step 5: Save only (no navigation) */}
          {activeStep === 5 && currentAuditId !== null && (
            <Button
              variant="outline"
              className="rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50 gap-2"
              onClick={handleSave}
              disabled={patchAudit.isPending || !isDirty}
            >
              {patchAudit.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Project
            </Button>
          )}

          {/* Steps 1-4: Save & Continue */}
          {activeStep < 5 && (
            <Button
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={handleNextStep}
              disabled={isCreating}
            >
              {isCreating && activeStep === 1 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save & Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Lightbox modal */}
      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
