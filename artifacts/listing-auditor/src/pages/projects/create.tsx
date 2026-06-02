import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowRight, Check, Image as ImageIcon, Loader2, X, Trash2 } from "lucide-react";

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

export default function CreateProject() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Step 2
  const [lifestyleEnabled, setLifestyleEnabled] = useState(true);
  const [lifestyleCount, setLifestyleCount] = useState(5);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [featureCount, setFeatureCount] = useState(3);

  // Step 3
  const [designStyle, setDesignStyle] = useState("modern");

  const createProject = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`${basePath}/api/graphics/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: (project) => {
      // Start generation
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const canContinue = () => {
    if (step === 1) return productName.trim().length > 0;
    if (step === 2) return lifestyleEnabled || featureEnabled;
    return true;
  };

  const handleContinue = () => {
    if (step === 3) {
      const totalImages = (lifestyleEnabled ? lifestyleCount : 0) + (featureEnabled ? featureCount : 0);
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
    <div className="max-w-2xl mx-auto py-6">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-purple-600">Step {step} of 3</span>
          <span className="text-xs text-slate-400">
            {step === 1 ? "Upload Product" : step === 2 ? "Select Graphics" : "Choose Design Style"}
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${s <= step ? "bg-purple-600" : "bg-slate-200"}`}
                style={{ width: s === step ? "60%" : s < step ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Product */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Upload Product</h2>

          <div
            className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {uploadedImage ? (
              <div className="relative inline-block">
                <img src={uploadedImage} alt="Uploaded" className="w-48 h-48 object-contain rounded-lg" />
                <button
                  className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-2">Drag & Drop Product Image</p>
                <p className="text-xs text-slate-400 mb-4">or</p>
                <Button
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>
                <p className="text-xs text-slate-400 mt-3">PNG, JPG up to 20MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Product Name</label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Stainless Steel Water Bottle"
                className="border-slate-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Product Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Select Graphics */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Select Graphics</h2>
          <p className="text-sm text-slate-500">What would you like to create?</p>

          {/* Lifestyle Images */}
          <Card className="border border-slate-100 hover:border-purple-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${lifestyleEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
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
                      <p className="text-xs font-medium text-slate-600 mb-2">Choose quantity</p>
                      <div className="flex gap-2">
                        {QUANTITY_OPTIONS.lifestyle.map((q) => (
                          <button
                            key={q}
                            onClick={() => setLifestyleCount(q)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${lifestyleCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                          >
                            {q} images
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Graphics */}
          <Card className="border border-slate-100 hover:border-purple-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${featureEnabled ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"}`}
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
                      <p className="text-xs font-medium text-slate-600 mb-2">Choose quantity</p>
                      <div className="flex gap-2">
                        {QUANTITY_OPTIONS.feature.map((q) => (
                          <button
                            key={q}
                            onClick={() => setFeatureCount(q)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${featureCount === q ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                          >
                            {q} {q === 1 ? "Graphic" : "Graphics"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Choose Design Style */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Choose Design Style</h2>
          <p className="text-sm text-slate-500">Select a style that best represents your brand</p>

          <div className="grid grid-cols-2 gap-4">
            {DESIGN_STYLES.map((style) => (
              <div
                key={style.id}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${designStyle === style.id ? "border-purple-600" : "border-transparent hover:border-slate-200"}`}
                onClick={() => setDesignStyle(style.id)}
              >
                <div className="aspect-[4/3] relative">
                  <img src={style.img} alt={style.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/10" />
                </div>
                <div className="absolute top-2 right-2">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${designStyle === style.id ? "border-purple-600" : "border-slate-300"}`}>
                    {designStyle === style.id && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm">
                  <p className="font-semibold text-sm text-slate-900">{style.label}</p>
                  <p className="text-xs text-slate-400">{style.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <Button variant="ghost" className="text-slate-500" onClick={() => setStep((s) => (s - 1) as Step)}>
            Back
          </Button>
        ) : (
          <div />
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
          ) : step === 3 ? (
            <>
              Generate Graphics
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
