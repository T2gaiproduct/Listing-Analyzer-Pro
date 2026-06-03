import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowRight, Check, Image as ImageIcon, Loader2, Trash2, Wand2, Sparkles, Search } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const AMAZON_CATEGORIES = [
  "Alexa Skills",
  "Amazon Pharmacy",
  "Amazon Subscribe & Save",
  "Appliances",
  "Apps & Games",
  "Arts, Crafts & Sewing",
  "Automotive",
  "Baby",
  "Beauty & Personal Care",
  "Books",
  "CDs & Vinyl",
  "Camera & Photo",
  "Cell Phones & Accessories",
  "Clothing, Shoes & Jewelry",
  "Collectible Coins",
  "Computers & Accessories",
  "Costumes & Accessories",
  "Digital Educational Resources",
  "Digital Music",
  "Electronics",
  "Entertainment Collectibles",
  "Fine Art",
  "Food & Beverage",
  "Furniture & Décor",
  "Gift Cards",
  "Grocery & Gourmet Food",
  "Handmade",
  "Health & Household",
  "Health, Fitness & Dieting",
  "Home & Business Services",
  "Home & Kitchen",
  "Home & Garden",
  "Industrial & Scientific",
  "Jewelry & Watches",
  "Kindle Store",
  "Kitchen & Dining",
  "Luggage & Travel Gear",
  "Magazines & Newspapers",
  "Medical Supplies & Equipment",
  "Movies & TV",
  "Musical Instruments",
  "Office Products",
  "Outdoor Recreation",
  "Pet Supplies",
  "Premium Beauty",
  "Professional Dental Supplies",
  "Shoes",
  "Software",
  "Sports & Outdoors",
  "Sports Collectibles",
  "Tools & Home Improvement",
  "Toys & Games",
  "Video Games",
  "Watches",
  "Wine",
];

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6];

const DESIGN_STYLES = [
  { id: "custom", label: "Custom / Manual", desc: "Use only your prompt, no style" },
  { id: "modern", label: "Modern", desc: "Contemporary, clean, bold" },
  { id: "luxury", label: "Luxury", desc: "Dramatic, opulent, moody" },
  { id: "outdoor", label: "Outdoor", desc: "Natural, scenic, adventure" },
  { id: "minimalist", label: "Minimalist", desc: "Clean, simple, white space" },
];

const PROMPT_MAX_CHARS = 1000;

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1, label: "Upload Product" },
  { id: 2, label: "Select Graphics" },
  { id: 3, label: "Design Style" },
];

export default function CreateProject() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lifestyleEnabled, setLifestyleEnabled] = useState(true);
  const [lifestyleCount, setLifestyleCount] = useState(5);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [featureCount, setFeatureCount] = useState(3);
  const [designStyle, setDesignStyle] = useState("custom");
  const [lifestylePrompt, setLifestylePrompt] = useState("");
  const [featurePrompt, setFeaturePrompt] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCategories = AMAZON_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(categorySearch.toLowerCase())
  );

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
        throw new Error(err.error || `Failed to create project (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (project) => {
      fetch(`${basePath}/api/graphics/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customLifestylePrompt: lifestylePrompt.trim() || undefined,
          customFeaturePrompt: featurePrompt.trim() || undefined,
        }),
      });
      nav(`/projects/${project.id}/generating`);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create", variant: "destructive" });
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const rawFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (rawFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please upload image files only", variant: "destructive" });
      return;
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    const MIN_FILE_SIZE = 1024; // 1 KB
    const MIN_WIDTH = 256;
    const MIN_HEIGHT = 256;

    const validFiles: File[] = [];
    let dimensionChecks = 0;

    for (const file of rawFiles) {
      if (file.size < MIN_FILE_SIZE) {
        toast({ title: "Image too small", description: `"${file.name}" is only ${file.size} bytes. It may be corrupted or too low quality.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Image too large", description: `"${file.name}" exceeds the 20 MB limit.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    const results: string[] = [];
    let loaded = 0;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
            toast({ title: "Image too small", description: `"${file.name}" is ${img.width}x${img.height}. Minimum recommended size is ${MIN_WIDTH}x${MIN_HEIGHT}px for best AI results.`, variant: "destructive" });
          } else {
            results.push(dataUrl);
          }
          dimensionChecks++;
          if (dimensionChecks === validFiles.length) {
            setUploadedImages((prev) => [...prev, ...results]);
            setIsUploading(false);
          }
        };
        img.onerror = () => {
          toast({ title: "Invalid image", description: `"${file.name}" could not be loaded.`, variant: "destructive" });
          dimensionChecks++;
          if (dimensionChecks === validFiles.length) {
            setUploadedImages((prev) => [...prev, ...results]);
            setIsUploading(false);
          }
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        toast({ title: "Read failed", description: `"${file.name}" could not be read.`, variant: "destructive" });
        dimensionChecks++;
        if (dimensionChecks === validFiles.length) {
          setUploadedImages((prev) => [...prev, ...results]);
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canContinue = () => {
    if (step === 1) return productName.trim().length > 0;
    if (step === 2) return lifestyleEnabled || featureEnabled;
    return true;
  };

  const handleContinue = () => {
    if (step === 3) {
      createProject.mutate({
        name: `${productName} Project`,
        productName,
        category,
        sourceImageUrls: uploadedImages,
        designStyle,
        lifestyleCount: lifestyleEnabled ? lifestyleCount : 0,
        featureCount: featureEnabled ? featureCount : 0,
        customLifestylePrompt: lifestylePrompt.trim() || undefined,
        customFeaturePrompt: featurePrompt.trim() || undefined,
      });
    } else {
      setStep((s) => (s + 1) as Step);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Step indicator */}
      <div className="mb-10">
        <div className="flex items-center">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s.id < step ? "bg-purple-600 text-white" :
                  s.id === step ? "bg-purple-600 text-white" :
                  "bg-white text-slate-400 border-2 border-slate-200"
                }`}>
                  {s.id < step ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.id === step ? "text-purple-600" : "text-slate-400"}`}>
                    Step {s.id} of 3
                  </p>
                  <p className={`text-sm font-medium ${s.id === step ? "text-slate-900" : "text-slate-400"}`}>
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-6 ${s.id < step ? "bg-purple-600" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Product */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload Product</h2>
              <p className="text-sm text-slate-500">Upload one or more images of your product. We&apos;ll use them to create stunning graphics.</p>
            </div>
          </div>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-purple-200 rounded-xl p-12 text-center bg-purple-50/20 hover:bg-purple-50/30 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Drag & drop your product images here</p>
            <p className="text-sm text-slate-400 mb-4">or</p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Images
            </Button>
            <p className="text-xs text-slate-400 mt-3">PNG, JPG up to 20MB each. Multiple images supported.</p>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </div>

          {/* Image Preview + Form */}
          {uploadedImages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              {/* Image Preview */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Uploaded Images ({uploadedImages.length})
                </p>
                <div className="flex flex-wrap gap-4">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-[140px] h-[140px] rounded-lg border border-slate-100 overflow-hidden bg-white flex-shrink-0">
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                      <button
                        className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center text-red-500 hover:text-red-600"
                        onClick={() => removeImage(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Name</label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Enter product name"
                    className="border-slate-200 h-11 rounded-lg"
                  />
                </div>
                <div className="relative" ref={categoryRef}>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Category</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      value={categorySearch}
                      onChange={(e) => {
                        setCategorySearch(e.target.value);
                        setShowCategoryDropdown(true);
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      placeholder="Search Amazon category..."
                      className="border-slate-200 h-11 rounded-lg pl-9"
                    />
                    {showCategoryDropdown && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto overscroll-contain">
                        {filteredCategories.length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                        )}
                        {filteredCategories.map((c) => (
                          <div
                            key={c}
                            className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-purple-50 ${category === c ? "bg-purple-50 text-purple-700 font-medium" : "text-slate-700"}`}
                            onClick={() => {
                              setCategory(c);
                              setCategorySearch(c);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Graphics */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Select Graphics</h2>
              <p className="text-sm text-slate-500">What would you like to create?</p>
            </div>
          </div>

          {/* Lifestyle Images */}
          <div className={`rounded-xl border-2 p-5 transition-all ${lifestyleEnabled ? "border-purple-200 bg-purple-50/20" : "border-slate-100 bg-white"}`}>
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${lifestyleEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
                onClick={() => setLifestyleEnabled(!lifestyleEnabled)}
              >
                {lifestyleEnabled ? <Check className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">Lifestyle Images</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Realistic lifestyle images of your product</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${lifestyleEnabled ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}
                    onClick={() => setLifestyleEnabled(!lifestyleEnabled)}
                  >
                    {lifestyleEnabled && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                {lifestyleEnabled && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-600 mb-2">Lifestyle Images</p>
                    <p className="text-xs text-slate-400 mb-3">Choose quantity</p>
                    <div className="flex gap-2">
                      {QUANTITY_OPTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => setLifestyleCount(q)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${lifestyleCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature / Infographics */}
          <div className={`rounded-xl border-2 p-5 transition-all ${featureEnabled ? "border-purple-200 bg-purple-50/20" : "border-slate-100 bg-white"}`}>
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${featureEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
                onClick={() => setFeatureEnabled(!featureEnabled)}
              >
                {featureEnabled ? <Check className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">Infographics</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Highlight features and benefits</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${featureEnabled ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}
                    onClick={() => setFeatureEnabled(!featureEnabled)}
                  >
                    {featureEnabled && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                {featureEnabled && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-600 mb-2">Infographics</p>
                    <p className="text-xs text-slate-400 mb-3">Choose quantity</p>
                    <div className="flex gap-2">
                      {QUANTITY_OPTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => setFeatureCount(q)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${featureCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Choose Design Style */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Choose Design Style</h2>
              <p className="text-sm text-slate-500">Select a style. Optionally add custom prompts to replace the default AI template.</p>
            </div>
          </div>

          {lifestyleEnabled && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Lifestyle Custom Prompt <span className="text-slate-400 font-normal">(optional)</span>
                {lifestylePrompt.length > 0 && (
                  <span className={`ml-2 text-xs font-medium ${lifestylePrompt.length > PROMPT_MAX_CHARS ? "text-red-500" : lifestylePrompt.length > PROMPT_MAX_CHARS * 0.8 ? "text-amber-500" : "text-slate-400"}`}>
                    {lifestylePrompt.length} / {PROMPT_MAX_CHARS}
                  </span>
                )}
              </label>
              <Textarea
                value={lifestylePrompt}
                onChange={(e) => setLifestylePrompt(e.target.value)}
                placeholder="Describe your desired scene, lighting, background, and composition. For best results, be specific and detailed. Custom prompts give you full control over the output."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
          {featureEnabled && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Infographic Custom Prompt <span className="text-slate-400 font-normal">(optional)</span>
                {featurePrompt.length > 0 && (
                  <span className={`ml-2 text-xs font-medium ${featurePrompt.length > PROMPT_MAX_CHARS ? "text-red-500" : featurePrompt.length > PROMPT_MAX_CHARS * 0.8 ? "text-amber-500" : "text-slate-400"}`}>
                    {featurePrompt.length} / {PROMPT_MAX_CHARS}
                  </span>
                )}
              </label>
              <Textarea
                value={featurePrompt}
                onChange={(e) => setFeaturePrompt(e.target.value)}
                placeholder="Describe your desired scene, lighting, background, and composition. For best results, be specific and detailed. Custom prompts give you full control over the output."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {DESIGN_STYLES.map((style) => {
              const isCustom = style.id === "custom";
              const isSelected = designStyle === style.id;
              return (
                <div
                  key={style.id}
                  className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all p-3 ${isSelected ? "border-purple-600 bg-purple-50/30" : "border-slate-200 hover:border-slate-300"}`}
                  onClick={() => setDesignStyle(style.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{style.label}</p>
                      <p className="text-xs text-slate-400 leading-tight">{style.desc}</p>
                    </div>
                    {isCustom && (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300"}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-6">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
            disabled={!canContinue() || createProject.isPending}
            onClick={handleContinue}
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {step === 3 ? "Generate Graphics" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
