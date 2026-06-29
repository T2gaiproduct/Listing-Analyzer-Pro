import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCreateAudit,
  useGenerateContent,
  useGenerateContentDirect,
  useGetAudit,
  getGetAuditStatsQueryKey,
  getListAuditsQueryKey,
  getGetAuditQueryKey,
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
  useEffect(() => {
    if (resumeAuditId && !isNaN(resumeAuditId)) {
      setCurrentAuditId(resumeAuditId);
      setActiveStep(2);
    }
  }, [resumeAuditId]);

  /* ── Upload step state ── */
  const fileRef    = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
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
  const [auditResult, setAuditResult] = useState<null | {
    titleScore: { score: number; issues: string[]; suggestions: string[] };
    bulletScore: { score: number; issues: string[]; suggestions: string[] };
    imageScore: { score: number; issues: string[]; suggestions: string[] };
    keywordScore: { score: number; issues: string[]; suggestions: string[] };
    overallScore: number;
    summary: string;
  }>(null);
  const createAudit  = useCreateAudit();
  const generateContent = useGenerateContent();
  const generateContentDirect = useGenerateContentDirect();
  const { data: auditData } = useGetAudit(currentAuditId ?? 0, {
    query: { enabled: currentAuditId !== null && !auditResult, queryKey: getGetAuditQueryKey(currentAuditId ?? 0) },
  });

  /* ── Graphics step state ── */
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt]             = useState("");

  /* ── Poll for audit results when we have an audit ID ── */
  useEffect(() => {
    if (!auditData || !currentAuditId || auditResult) return;
    if (auditData.status === "complete" && auditData.result) {
      setAuditResult(auditData.result as any);
      // Now also generate content
      generateContent.mutate(
        { id: currentAuditId },
        {
          onSuccess: (data) => {
            setIsCreating(false);
            setGeneratedContent(data);
            toast({ title: "Complete!", description: "Audit and listing content are ready." });
          },
          onError: (err) => {
            setIsCreating(false);
            toast({ title: "Content failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
          },
        }
      );
    } else if (auditData.status === "failed") {
      setIsCreating(false);
      toast({ title: "Audit failed", description: auditData.result?.summary || "Analysis failed", variant: "destructive" });
    }
  }, [auditData, currentAuditId, auditResult, generateContent, toast]);

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

  /* ── Poll graphics project status ── */
  useEffect(() => {
    if (!graphicsProjectId || graphicsStatus === "completed" || graphicsStatus === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(`${basePath}/api/graphics/projects/${graphicsProjectId}`, { credentials: "include" });
        if (!res.ok) return;
        const project = await res.json() as {
          status: string;
          generatedCount: number;
          lifestyleCount: number;
          featureCount: number;
          imageRecords?: Array<{ urlPath?: string; type?: string; index?: number }>;
          errorMessage?: string | null;
        };
        setGraphicsStatus(project.status);
        const total = (project.lifestyleCount ?? 0) + (project.featureCount ?? 0);
        setGraphicsProgress({ generated: project.generatedCount ?? 0, total });
        if (project.imageRecords) {
          setGeneratedImages(
            project.imageRecords
              .filter((r) => r.urlPath)
              .map((r) => ({ url: r.urlPath!, type: r.type ?? "lifestyle", index: r.index ?? 0 }))
          );
        }
        if (project.status === "completed") {
          setIsCreating(false);
          toast({ title: "Graphics ready!", description: `${total} images generated successfully.` });
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
  }, [graphicsProjectId, graphicsStatus, toast]);

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
      });
      setGraphicsProjectId(project.id);
      setGraphicsStatus("generating");
      setGeneratedImages([]);
      setGraphicsProgress({ generated: 0, total: selectedImageTypes.length });
      /* Stay in workflow — no nav() away */
    },
    onError: (err) => {
      setIsCreating(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    },
  });

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
      // Upload: just advance to next step after a brief load
      setTimeout(() => {
        setIsCreating(false);
        setActiveStep(2);
      }, 2500);

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
      createProject.mutate({
        name: `${productName || "Product"} Project`,
        productName: productName || "Product",
        category,
        sourceImageUrls: uploadedImages,
        imageTypes: selectedImageTypes,
        customPrompt: customPrompt.trim() || undefined,
      });

    } else if (activeStep === 4 || activeStep === 5) {
      // A+ Content / Export: simulate
      setTimeout(() => {
        setIsCreating(false);
        toast({ title: activeStep === 4 ? "A+ Content ready!" : "Export ready!", description: "Coming soon — this feature is launching shortly." });
      }, 3000);
    }
  }, [activeStep, selectedImageTypes, productName, category, uploadedImages, customPrompt, brandName, createAudit, createProject, queryClient, nav, toast]);

  /* ── Bottom bar ── */
  function handleBack() {
    if (activeStep === 1) nav("/audits/new");
    else setActiveStep((s) => (s - 1) as StepId);
  }

  /* ── Next step ── */
  function handleNextStep() {
    if (activeStep < 5) setActiveStep((s) => (s + 1) as StepId);
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Brand Name</label>
                    <Input
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Acme Co."
                      className="border-slate-200 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Product Name</label>
                    <Input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
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
                        setCategory={setCategory}
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

              {/* Audit Results Panel */}
              {auditResult && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <p className="text-sm font-semibold text-slate-900">Listing Audit Results</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Overall Score</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        auditResult.overallScore >= 80 ? "bg-emerald-100 text-emerald-700" :
                        auditResult.overallScore >= 60 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{auditResult.overallScore}</span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {[
                      { label: "Title", score: auditResult.titleScore },
                      { label: "Bullets", score: auditResult.bulletScore },
                      { label: "Images", score: auditResult.imageScore },
                      { label: "Keywords", score: auditResult.keywordScore },
                    ].map((cat) => (
                      <div key={cat.label} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{cat.label} Analysis</span>
                            {cat.score.issues.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">{cat.score.issues.length} issues</span>
                            )}
                            {cat.score.suggestions.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-semibold">{cat.score.suggestions.length} suggestions</span>
                            )}
                          </div>
                          <span className={`text-sm font-bold ${
                            cat.score.score >= 80 ? "text-emerald-600" :
                            cat.score.score >= 60 ? "text-amber-600" :
                            "text-red-600"
                          }`}>{cat.score.score}/100</span>
                        </div>
                        {/* Issues */}
                        {cat.score.issues.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Issues</p>
                            <ul className="space-y-1">
                              {cat.score.issues.map((issue, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Suggestions */}
                        {cat.score.suggestions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Suggestions</p>
                            <ul className="space-y-1">
                              {cat.score.suggestions.map((s, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="text-emerald-500 mt-0.5">✓</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Summary */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-sm text-slate-700">{auditResult.summary}</p>
                    </div>
                  </div>
                </div>
              )}

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
                      {descViewMode === "preview" ? (
                        <div className="text-sm text-slate-700 leading-relaxed border rounded-md p-3 bg-slate-50" dangerouslySetInnerHTML={{ __html: generatedContent.htmlDescription }} />
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
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Create Product Graphics</h2>
                  <p className="text-sm text-slate-500">Choose the image types you want to generate</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {IMAGE_TYPES.map((type) => {
                  const isSelected = selectedImageTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() =>
                        setSelectedImageTypes((prev) =>
                          prev.includes(type.id) ? prev.filter((s) => s !== type.id) : [...prev, type.id]
                        )
                      }
                      className={cn(
                        "relative rounded-xl border-2 p-4 text-left transition-all",
                        isSelected ? "border-orange-500 bg-orange-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <span className="text-2xl leading-none block mb-2">{type.icon}</span>
                      <p className={cn("text-sm font-semibold", isSelected ? "text-orange-900" : "text-slate-900")}>
                        {type.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{type.desc}</p>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedImageTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 font-semibold text-xs">
                    {selectedImageTypes.length} selected
                  </span>
                  <span className="text-sm text-slate-400">~{selectedImageTypes.length * 30}s total</span>
                </div>
              )}

              {selectedImageTypes.includes("custom") && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4 space-y-3">
                  <label className="text-sm font-medium text-orange-900">Custom Prompt</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe exactly what you want the AI to create..."
                    rows={3}
                    className="w-full resize-none text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              )}

              {/* Generate Graphics button */}
              <Button
                size="lg"
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2 shadow-lg shadow-orange-500/20"
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">
                      Generating {graphicsProgress.total} image{graphicsProgress.total > 1 ? "s" : ""}…
                    </span>
                    <span className="text-orange-600 font-semibold">
                      {graphicsProgress.generated} / {graphicsProgress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${graphicsProgress.total > 0 ? (graphicsProgress.generated / graphicsProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Generated images grid */}
              {generatedImages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Generated Images ({generatedImages.length})
                    </h3>
                    {graphicsStatus === "completed" && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Complete
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: "🖼️", title: "Hero Banner",       desc: "Full-width product hero image with headline" },
                  { icon: "📋", title: "Feature Highlights", desc: "Icon + text modules showcasing key features" },
                  { icon: "📊", title: "Comparison Chart",  desc: "Compare your product against competitors" },
                  { icon: "📖", title: "Brand Story",       desc: "Tell your brand story with rich imagery" },
                ].map((module) => (
                  <div key={module.title} className="border border-slate-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50/20 transition-all cursor-pointer">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{module.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{module.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{module.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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
          {/* Steps 1-4: Next Step button */}
          {activeStep < 5 && (
            <Button
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={handleNextStep}
              disabled={isCreating}
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
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
