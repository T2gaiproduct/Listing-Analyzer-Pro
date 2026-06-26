import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Monitor,
  Camera,
  Search,
  ChevronDown,
  Check,
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  Wand2,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFetchListing,
  useCreateAudit,
  getGetAuditStatsQueryKey,
  getListAuditsQueryKey,
} from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Steps ─────────────────────────────────────────────────────────────── */
type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; key: string; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 1, key: "upload",   label: "UPLOAD",     sub: "Upload product images",   icon: Upload    },
  { id: 2, key: "listing",  label: "LISTING",    sub: "Create listing content",  icon: FileText  },
  { id: 3, key: "graphics", label: "GRAPHICS",   sub: "Create product graphics", icon: ImageIcon },
  { id: 4, key: "aplus",    label: "A+ CONTENT", sub: "Create A+ content",       icon: Sparkles  },
  { id: 5, key: "export",   label: "EXPORT",     sub: "Export & publish",        icon: Download  },
];

const CREATE_DROPDOWN: { label: string; step: StepId }[] = [
  { label: "Listing",    step: 2 },
  { label: "Graphics",   step: 3 },
  { label: "A+ Content", step: 4 },
  { label: "Export",     step: 5 },
];

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
    "Fetching listing data…",
    "Analyzing product title…",
    "Evaluating bullet points…",
    "Scoring keyword density…",
    "Generating recommendations…",
    "Finalizing your audit…",
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

/* ── Amazon categories ──────────────────────────────────────────────────── */
const AMAZON_CATEGORIES = [
  "Appliances", "Apps & Games", "Arts, Crafts & Sewing", "Automotive", "Baby",
  "Beauty & Personal Care", "Books", "Camera & Photo", "Cell Phones & Accessories",
  "Clothing, Shoes & Jewelry", "Computers & Accessories", "Electronics",
  "Food & Beverage", "Furniture & Décor", "Grocery & Gourmet Food", "Handmade",
  "Health & Household", "Home & Kitchen", "Industrial & Scientific", "Jewelry & Watches",
  "Kitchen & Dining", "Luggage & Travel Gear", "Movies & TV", "Musical Instruments",
  "Office Products", "Outdoor Recreation", "Pet Supplies", "Software",
  "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games", "Video Games",
  "Watches",
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
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const [activeStep, setActiveStep] = useState<StepId>(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Creating panel state ── */
  const [isCreating, setIsCreating]         = useState(false);
  const [creatingStep, setCreatingStep]     = useState<StepId>(1);

  /* ── Upload step state ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const [productName, setProductName]   = useState("");
  const [category, setCategory]         = useState("");
  const [catSearch, setCatSearch]       = useState("");
  const [catOpen, setCatOpen]           = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading]       = useState(false);

  /* ── Listing step state ── */
  const [listingUrl, setListingUrl] = useState("");
  const fetchListing = useFetchListing();
  const createAudit  = useCreateAudit();

  /* ── Graphics step state ── */
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt]             = useState("");

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
      if (catRef.current && !catRef.current.contains(e.target as Node))
        setCatOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    onSuccess: (project: { id: number }) => {
      void fetch(`${basePath}/api/graphics/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageTypes: selectedImageTypes, customPrompt: customPrompt.trim() || undefined }),
      });
      setIsCreating(false);
      nav(`/projects/${project.id}/generating`);
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
    setDropdownOpen(false);

    if (activeStep === 1) {
      // Upload: just advance to next step after a brief load
      setTimeout(() => {
        setIsCreating(false);
        setActiveStep(2);
      }, 2500);

    } else if (activeStep === 2) {
      // Listing: analyze
      const trimmed = listingUrl.trim();
      if (!trimmed) {
        setIsCreating(false);
        toast({ title: "Enter a URL or ASIN", description: "Please enter a product URL or ASIN first.", variant: "destructive" });
        return;
      }
      const isUrl = trimmed.startsWith("http");
      fetchListing.mutate(
        { data: isUrl ? { url: trimmed } : { asin: trimmed } },
        {
          onSuccess: (listing) => {
            createAudit.mutate(
              {
                data: {
                  productName: listing.productName,
                  asin: listing.asin,
                  category: listing.category ?? undefined,
                  title: listing.title,
                  bulletPoints: listing.bulletPoints,
                  targetKeywords: listing.targetKeywords,
                  imageUrls: listing.imageUrls,
                },
              },
              {
                onSuccess: (audit) => {
                  void queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
                  void queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
                  setIsCreating(false);
                  toast({ title: "Listing analyzed!", description: "Your audit is ready." });
                  nav(`/audits/${audit.id}?returnTo=/audits/workflow`);
                },
                onError: (err) => {
                  setIsCreating(false);
                  toast({ title: "Failed", description: err instanceof Error ? err.message : "Could not create audit", variant: "destructive" });
                },
              }
            );
          },
          onError: (err) => {
            setIsCreating(false);
            toast({ title: "Failed to fetch", description: err instanceof Error ? err.message : "Could not fetch listing", variant: "destructive" });
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
  }, [activeStep, listingUrl, selectedImageTypes, productName, category, uploadedImages, customPrompt, fetchListing, createAudit, createProject, queryClient, nav, toast]);

  /* ── Bottom bar ── */
  function handleBack() {
    if (activeStep === 1) nav("/audits/new");
    else setActiveStep((s) => (s - 1) as StepId);
  }

  function handleSave() {
    toast({ title: "Saved", description: "Your progress has been saved." });
  }

  const filteredCats = AMAZON_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(catSearch.toLowerCase())
  );

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full min-h-screen bg-white">

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
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Upload Product</h2>
                  <p className="text-sm text-slate-500">Upload product images to get started</p>
                </div>
              </div>

              <div
                className="border-2 border-dashed border-orange-200 rounded-2xl bg-orange-50/20 p-10 flex flex-col items-center gap-4 cursor-pointer hover:bg-orange-50/40 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-base font-medium text-slate-700">Choose upload option</p>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="flex flex-col items-center gap-3 p-6 bg-white border border-orange-100 rounded-xl hover:border-orange-300 hover:shadow-sm transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-800">From Computer</p>
                      <p className="text-xs text-slate-400 mt-0.5">Upload images from your computer</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="flex flex-col items-center gap-3 p-6 bg-white border border-orange-100 rounded-xl hover:border-orange-300 hover:shadow-sm transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-800">From Camera</p>
                      <p className="text-xs text-slate-400 mt-0.5">Take photos using your camera</p>
                    </div>
                  </button>
                </div>

                <p className="text-xs text-slate-400">PNG, JPG up to 20MB each</p>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </div>

              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                      <button
                        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-red-500 hover:text-red-600"
                        onClick={() => setUploadedImages((p) => p.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Product Name</label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Enter product name"
                    className="border-slate-200 rounded-xl h-11"
                  />
                </div>

                <div className="space-y-1.5" ref={catRef}>
                  <label className="text-sm font-medium text-slate-700">Select Category</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      value={catSearch}
                      onChange={(e) => { setCatSearch(e.target.value); setCatOpen(true); }}
                      onFocus={() => setCatOpen(true)}
                      placeholder="Search or select category"
                      className="w-full h-11 pl-9 pr-10 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    {catOpen && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {filteredCats.length === 0
                          ? <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                          : filteredCats.map((c) => (
                            <div
                              key={c}
                              className={cn("px-3 py-2 text-sm cursor-pointer hover:bg-orange-50", category === c ? "bg-orange-50 text-orange-600 font-medium" : "text-slate-700")}
                              onClick={() => { setCategory(c); setCatSearch(c); setCatOpen(false); }}
                            >
                              {c}
                            </div>
                          ))
                        }
                      </div>
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
                  <p className="text-sm text-slate-500">Enter a product URL or ASIN to analyze and generate optimized content</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <label className="text-sm font-medium text-slate-700">Amazon Product URL or ASIN</label>
                <div className="flex gap-3">
                  <Input
                    value={listingUrl}
                    onChange={(e) => setListingUrl(e.target.value)}
                    placeholder="https://amazon.com/dp/... or B0XXXXXXXXX"
                    className="border-slate-200 rounded-xl h-11 flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  />
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">What gets analyzed</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {["Product Title", "Bullet Points", "Keywords", "Images"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-orange-500" />
                        </div>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-900">AI-Powered Optimization</p>
                  <p className="text-sm text-orange-700 mt-1">Our AI scores your listing across 4 key categories — title, bullet points, images, and keywords — then provides actionable fixes.</p>
                </div>
              </div>
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
                  { icon: "📄", title: "Export as PDF",     desc: "Full listing report with all content",  action: "Download PDF"   },
                  { icon: "🗂️", title: "Export as ZIP",     desc: "All images + listing text bundled",     action: "Download ZIP"   },
                  { icon: "🛒", title: "Publish to Amazon", desc: "Push directly to Seller Central",       action: "Connect & Push" },
                ].map((opt) => (
                  <div key={opt.title} className="border border-slate-200 rounded-xl p-5 flex flex-col gap-4 hover:border-orange-300 hover:shadow-sm transition-all">
                    <span className="text-3xl">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{opt.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50 w-full"
                      onClick={() => toast({ title: "Coming soon", description: `${opt.action} is coming soon.` })}
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
          <Button
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
            onClick={handleSave}
            disabled={isCreating}
          >
            <Save className="w-4 h-4" />
            Save
          </Button>

          {/* Split Create button */}
          <div className="flex items-center" ref={dropdownRef}>
            {/* Main action */}
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-l-xl rounded-r-none gap-2 border-r border-orange-600"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating
                ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
                : <><Sparkles className="w-4 h-4" />Create</>
              }
            </Button>
            {/* Dropdown arrow */}
            <div className="relative">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-l-none rounded-r-xl px-2.5"
                onClick={() => setDropdownOpen((o) => !o)}
                disabled={isCreating}
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", dropdownOpen ? "rotate-180" : "")} />
              </Button>

              {dropdownOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                  {CREATE_DROPDOWN.map((item) => (
                    <button
                      key={item.label}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors hover:bg-orange-50",
                        activeStep === item.step ? "text-orange-600 bg-orange-50/70 font-medium" : "text-slate-700"
                      )}
                      onClick={() => { setActiveStep(item.step); setDropdownOpen(false); }}
                    >
                      {activeStep === item.step
                        ? <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        : <div className="w-3.5 h-3.5 flex-shrink-0" />
                      }
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
