import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { Upload, ArrowRight, Check, Image as ImageIcon, Loader2, Trash2, Wand2, Sparkles, Search, Camera, Monitor, Lightbulb } from "lucide-react";
import {
  CustomPromptGenerationPanel,
  type GraphicsAspectRatio,
  type GraphicsQuality,
} from "@/components/custom-prompt-generation-panel";

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

const IMAGE_TYPES = [
  { id: "hero", label: "Hero Shot", desc: "White background, product centered", icon: "🏆" },
  { id: "lifestyle", label: "Lifestyle In-Use", desc: "Product in use, real environment", icon: "🌅" },
  { id: "callouts", label: "Feature Callouts", desc: "Numbered features, arrows", icon: "🔢" },
  { id: "size", label: "Size Reference", desc: "Scale comparison with dimensions", icon: "📏" },
  { id: "beforeafter", label: "Before / After", desc: "Transformation comparison", icon: "⚡" },
  { id: "bundle", label: "Bundle Shot", desc: "All included items", icon: "📦" },
  { id: "social", label: "Social Proof", desc: "Ratings & reviews", icon: "⭐" },
  { id: "custom", label: "Generate Custom", desc: "Custom prompt", icon: "✨" },
];

const PROMPT_MAX_CHARS = 1000;

const CUSTOM_EXAMPLES = [
  "Show the product in a modern kitchen setting with warm natural lighting",
  "Create a minimalist product shot on a marble surface with soft shadows",
  "Show product being used by a family on a beach during golden hour",
  "Flat-lay overhead shot of product with complementary lifestyle props",
  "Product on a clean desk setup with laptop and coffee, work-from-home aesthetic",
];

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1, label: "Upload Product" },
  { id: 2, label: "Select Graphics" },
  { id: 3, label: "Custom Prompt" },
];

export default function CreateProject() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptReferenceImages, setPromptReferenceImages] = useState<string[]>([]);
  const [graphicsAspectRatio, setGraphicsAspectRatio] = useState<GraphicsAspectRatio>("1:1");
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("standard");

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
      void fetch(`${basePath}/api/graphics/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageTypes: selectedImageTypes,
          customPrompt: customPrompt.trim() || undefined,
          aspectRatio: graphicsAspectRatio,
          quality: graphicsQuality,
          promptReferenceImageUrls: promptReferenceImages.length > 0 ? promptReferenceImages : undefined,
        }),
      }).then(() => refreshCreditBalances(queryClient));
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
    if (step === 1) return brandName.trim().length > 0 && productName.trim().length > 0;
    if (step === 2) return selectedImageTypes.length > 0;
    if (step === 3) return customPrompt.trim().length > 0;
    return true;
  };

  const handleContinue = () => {
    if (step === 2 && !selectedImageTypes.includes("custom")) {
      // Non-custom selected: skip Step 3, generate directly
      createProject.mutate({
        name: `${productName} Project`,
        productName,
        category,
        sourceImageUrls: uploadedImages,
        imageTypes: selectedImageTypes,
        customPrompt: undefined,
      });
    } else if (step === 3) {
      // Custom selected: generate with prompt
      createProject.mutate({
        name: `${productName} Project`,
        productName,
        category,
        sourceImageUrls: uploadedImages,
        imageTypes: selectedImageTypes,
        customPrompt: customPrompt.trim() || undefined,
      });
    } else {
      setStep((s) => (s + 1) as Step);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Step indicator */}
      <div className="mb-4">
        <div className="flex items-center">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  s.id < step ? "bg-orange-600 text-white" :
                  s.id === step ? "bg-orange-600 text-white" :
                  "bg-white text-slate-400 border-2 border-slate-200"
                }`}>
                  {s.id < step ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <div className="mt-1 text-center">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.id === step ? "text-orange-600" : "text-slate-400"}`}>
                    Step {s.id} of 3
                  </p>
                  <p className={`text-xs font-medium ${s.id === step ? "text-slate-900" : "text-slate-400"}`}>
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 ${s.id < step ? "bg-orange-600" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Product Images */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Upload Product Images</h2>
              <p className="text-xs text-slate-500">Add high-quality images to showcase your product in the best way</p>
            </div>
          </div>

          {/* Two-column layout: Upload area + Uploaded images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Upload controls */}
            <div
              className="border-2 border-dashed border-orange-200 rounded-xl p-5 text-center bg-orange-50/20 hover:bg-orange-50/30 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-2">
                <Upload className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Drag or upload product images</p>
              <p className="text-xs text-slate-400 mb-3">PNG, JPG up to 20MB each</p>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-4 h-9 text-xs w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Monitor className="w-3.5 h-3.5 mr-1.5" />
                Upload from device
              </Button>
              <p className="text-xs text-slate-400 my-2">or</p>
              <Button
                variant="outline"
                className="border-slate-200 text-slate-600 rounded-lg px-4 h-9 text-xs w-full hover:bg-slate-50"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                Use camera
              </Button>
              <div className="mt-3 flex items-center gap-1.5 bg-orange-50 rounded-lg px-3 py-2">
                <Lightbulb className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                <p className="text-[11px] text-orange-700">Tip: Use high-quality images with good lighting for better results.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </div>

            {/* Right: Uploaded images preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-700 mb-2">
                Uploaded Images ({uploadedImages.length}/10)
              </p>
              {uploadedImages.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center">
                  <p className="text-sm text-slate-300">No images yet</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-[80px] h-[80px] rounded-lg border border-slate-100 overflow-hidden bg-white flex-shrink-0">
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                      <button
                        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow-sm flex items-center justify-center text-red-500 hover:text-red-600"
                        onClick={() => removeImage(idx)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Details section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Product Details</h2>
                <p className="text-xs text-slate-500">Provide basic information about your product</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Brand Name</label>
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Co."
                  className="border-slate-200 h-9 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Product Name</label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Enter product name"
                  className="border-slate-200 h-9 rounded-lg text-sm"
                />
              </div>
            </div>
            <div ref={categoryRef}>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Select Category</label>
              <div className="relative">
                <Input
                  value={categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setShowCategoryDropdown(true);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Search or select category"
                  className="border-slate-200 h-9 rounded-lg text-sm w-full"
                />
                {showCategoryDropdown && (
                  <div className="absolute z-[100] inset-x-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto overscroll-contain">
                    {filteredCategories.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-400">No categories found</div>
                    )}
                    {filteredCategories.map((c) => (
                      <div
                        key={c}
                        className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-orange-50 ${category === c ? "bg-orange-50 text-orange-700 font-medium" : "text-slate-700"}`}
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

      {/* Step 2: Select Graphics */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select Graphics</h2>
              <p className="text-xs text-slate-500">Choose the image types you want to generate. You can select multiple.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {IMAGE_TYPES.map((type) => {
              const isSelected = selectedImageTypes.includes(type.id);
              return (
                <div
                  key={type.id}
                  onClick={() => {
                    setSelectedImageTypes((prev) =>
                      prev.includes(type.id) ? prev.filter((s) => s !== type.id) : [...prev, type.id]
                    );
                  }}
                  className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-orange-600 bg-orange-50/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl leading-none mt-0.5">{type.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-semibold ${isSelected ? "text-orange-900" : "text-slate-900"}`}>
                          {type.label}
                        </h3>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "border-orange-600 bg-orange-600" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{type.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedImageTypes.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold text-xs">
                {selectedImageTypes.length} selected
              </span>
              <span className="text-slate-400">~{selectedImageTypes.length * 30}s total</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Design Style & Custom Prompt */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Design Style</h2>
              <p className="text-xs text-slate-500">Select a style and add a custom prompt if desired.</p>
            </div>
          </div>

          {selectedImageTypes.includes("custom") && (
            <CustomPromptGenerationPanel
              customPrompt={customPrompt}
              onCustomPromptChange={setCustomPrompt}
              referenceImages={promptReferenceImages}
              onReferenceImagesChange={setPromptReferenceImages}
              aspectRatio={graphicsAspectRatio}
              onAspectRatioChange={setGraphicsAspectRatio}
              quality={graphicsQuality}
              onQualityChange={setGraphicsQuality}
              promptMaxChars={PROMPT_MAX_CHARS}
              examplePrompts={CUSTOM_EXAMPLES}
            />
          )}

        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-3">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" className="text-slate-500 border-slate-200 rounded-lg h-8 text-xs" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-4 h-8 text-xs"
            disabled={!canContinue() || createProject.isPending}
            onClick={handleContinue}
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {step === 2 && !selectedImageTypes.includes("custom") ? "Generate" : step === 3 ? "Generate" : "Continue"}
                <ArrowRight className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
