import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowRight, Check, Image as ImageIcon, Loader2, Trash2, Wand2, Sparkles } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  "Sports & Outdoors",
  "Electronics",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Toys & Games",
  "Health & Wellness",
  "Clothing & Accessories",
  "Food & Beverage",
  "Office Supplies",
  "Pet Supplies",
  "Other",
];

const QUANTITY_OPTIONS = {
  lifestyle: [3, 5, 10],
  feature: [1, 3, 5],
};

const DESIGN_STYLES = [
  { id: "modern", label: "Modern", desc: "Contemporary, clean, bold", img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop" },
  { id: "luxury", label: "Luxury", desc: "Dramatic, opulent, moody", img: "https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=400&h=300&fit=crop" },
  { id: "outdoor", label: "Outdoor", desc: "Natural, scenic, adventure", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop" },
  { id: "minimalist", label: "Minimalist", desc: "Clean, simple, white space", img: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=400&h=300&fit=crop" },
];

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

  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lifestyleEnabled, setLifestyleEnabled] = useState(true);
  const [lifestyleCount, setLifestyleCount] = useState(5);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [featureCount, setFeatureCount] = useState(3);
  const [designStyle, setDesignStyle] = useState("modern");

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
        credentials: "include",
      });
      nav(`/projects/${project.id}/generating`);
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create", variant: "destructive" });
    },
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
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
        sourceImageUrl: uploadedImage,
        designStyle,
        lifestyleCount: lifestyleEnabled ? lifestyleCount : 0,
        featureCount: featureEnabled ? featureCount : 0,
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
              <p className="text-sm text-slate-500">Upload a clear image of your product. We&apos;ll use it to create stunning graphics.</p>
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
            <p className="text-sm font-medium text-slate-700 mb-1">Drag & drop your product image here</p>
            <p className="text-sm text-slate-400 mb-4">or</p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
            <p className="text-xs text-slate-400 mt-3">PNG, JPG up to 20MB</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          {/* Image Preview + Form */}
          {uploadedImage && (
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex gap-6">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  <p className="text-sm font-medium text-slate-700 mb-3">Image Preview</p>
                  <div className="relative w-[180px] h-[180px] rounded-lg border border-slate-100 overflow-hidden bg-white">
                    <img src={uploadedImage} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center text-red-500 hover:text-red-600"
                      onClick={() => setUploadedImage(null)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Name</label>
                    <Input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="sports shoes"
                      className="border-slate-200 h-11 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Product Category</label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
                      >
                        <option value="">Select category</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
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
                      {QUANTITY_OPTIONS.lifestyle.map((q) => (
                        <button
                          key={q}
                          onClick={() => setLifestyleCount(q)}
                          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${lifestyleCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {q} images
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature Graphics */}
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
                    <h3 className="font-semibold text-slate-900 text-sm">Feature Graphics</h3>
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
                    <p className="text-xs font-medium text-slate-600 mb-2">Feature Graphics</p>
                    <p className="text-xs text-slate-400 mb-3">Choose quantity</p>
                    <div className="flex gap-2">
                      {QUANTITY_OPTIONS.feature.map((q) => (
                        <button
                          key={q}
                          onClick={() => setFeatureCount(q)}
                          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${featureCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {q} {q === 1 ? "Graphic" : "Graphics"}
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
              <p className="text-sm text-slate-500">Select a style that best represents your brand</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {DESIGN_STYLES.map((style) => (
              <div
                key={style.id}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${designStyle === style.id ? "border-purple-600" : "border-transparent hover:border-slate-200"}`}
                onClick={() => setDesignStyle(style.id)}
              >
                <div className="aspect-[4/3] relative">
                  <img src={style.img} alt={style.label} className="w-full h-full object-cover" />
                </div>
                <div className="absolute top-3 right-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${designStyle === style.id ? "border-purple-600" : "border-slate-300"}`}>
                    {designStyle === style.id && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-sm text-slate-900">{style.label}</p>
                  <p className="text-xs text-slate-400">{style.desc}</p>
                </div>
              </div>
            ))}
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
