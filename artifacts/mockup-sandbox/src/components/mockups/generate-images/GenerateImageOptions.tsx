import { useState } from "react";

const IMAGE_TYPES = [
  { id: "hero", label: "Hero Shot", desc: "White background required", icon: "🏆" },
  { id: "lifestyle", label: "Lifestyle In-Use", desc: "Show product in use", icon: "🌅" },
  { id: "callouts", label: "Feature Callouts", desc: "Numbered features", icon: "🔢" },
  { id: "size", label: "Size Reference", desc: "Scale comparison", icon: "📏" },
  { id: "beforeafter", label: "Before / After", desc: "Transformation", icon: "⚡" },
  { id: "bundle", label: "Bundle Shot", desc: "All included items", icon: "📦" },
  { id: "social", label: "Social Proof", desc: "Ratings & reviews", icon: "⭐" },
  { id: "custom", label: "Generate Custom", desc: "Custom main listing image", icon: "✨" },
];

const PROMPT_EXAMPLES = [
  "A sleek coffee mug on a marble countertop with morning sunlight streaming through a window",
  "My product floating on a cloud against a pastel gradient background with soft shadows",
  "A 3D render of my product on a rotating pedestal with dramatic rim lighting",
];

export function GenerateImageOptions() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [step, setStep] = useState<"select" | "custom" | "generating">("select");
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedCount = selected.length;
  const customSelected = selected.includes("custom");
  const canProceed = selectedCount > 0;

  const handleContinue = () => {
    if (!canProceed) return;
    if (customSelected) {
      setStep("custom");
    } else {
      startGenerating();
    }
  };

  const handleBack = () => {
    setStep("select");
  };

  const handleStartGenerate = () => {
    if (customSelected && !customPrompt.trim()) return;
    startGenerating();
  };

  const startGenerating = () => {
    setStep("generating");
    setCountdown(selectedCount * 30);
    setProgress(0);
    let elapsed = 0;
    const total = selectedCount * 30;
    const interval = setInterval(() => {
      elapsed += 1;
      const remaining = Math.max(0, total - elapsed);
      setCountdown(remaining);
      setProgress(Math.min(100, (elapsed / total) * 100));
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[540px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Generate More Images</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {step === "select" && "Select image types to generate"}
                {step === "custom" && "Describe your custom image"}
                {step === "generating" && "Generating your images"}
              </p>
            </div>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* ====== STEP 1: SELECT ====== */}
          {step === "select" && (
            <>
              <p className="text-sm text-slate-500 mb-4">Choose the image types you want to generate. You can select multiple.</p>

              {/* Grid of options */}
              <div className="grid grid-cols-2 gap-3">
                {IMAGE_TYPES.map((type) => {
                  const isSelected = selected.includes(type.id);
                  return (
                    <div
                      key={type.id}
                      onClick={() => toggle(type.id)}
                      className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-purple-600 bg-purple-50/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl leading-none mt-0.5">{type.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-semibold ${isSelected ? "text-purple-900" : "text-slate-900"}`}>
                              {type.label}
                            </h3>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300"
                              }`}
                            >
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{type.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary */}
              {selectedCount > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs">
                    {selectedCount} selected
                  </span>
                  <span className="text-slate-400">
                    ~{selectedCount * 30}s total
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
                <button
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => { setSelected([]); setCustomPrompt(""); }}
                >
                  Clear
                </button>
                <button
                  onClick={handleContinue}
                  disabled={!canProceed}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2 ${
                    canProceed
                      ? "bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  {customSelected ? "Continue" : "Generate"}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 7H12.25M12.25 7L8.75 3.5M12.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* ====== STEP 2: CUSTOM PROMPT ====== */}
          {step === "custom" && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-purple-700">Custom Image</span>
                </div>
                <p className="text-sm text-slate-500 ml-10">
                  Describe exactly what you want your custom image to look like.
                </p>
              </div>

              {/* Textarea */}
              <div className="space-y-3">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe your scene, lighting, composition, background, and any specific details you want included..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{customPrompt.length} characters</span>
                  <span className={`${customPrompt.trim().length > 0 ? "text-purple-600" : "text-slate-400"}`}>
                    {customPrompt.trim().length > 0 ? "Ready to generate" : "Add a prompt to continue"}
                  </span>
                </div>
              </div>

              {/* Prompt Examples */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Need inspiration? Try these:</p>
                <div className="space-y-2">
                  {PROMPT_EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setCustomPrompt(ex)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-600 hover:border-purple-300 hover:bg-purple-50/30 transition-all leading-snug"
                    >
                      <span className="text-purple-400 mr-2">"</span>{ex}<span className="text-purple-400 ml-2">"</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected types preview */}
              {selected.filter(s => s !== "custom").length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Also generating:</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.filter(s => s !== "custom").map((id) => {
                      const type = IMAGE_TYPES.find((t) => t.id === id);
                      return (
                        <span key={id} className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                          {type?.icon} {type?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <button
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M12.25 7H1.75M1.75 7L5.25 3.5M1.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back
                </button>
                <button
                  onClick={handleStartGenerate}
                  disabled={!customPrompt.trim()}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2 ${
                    customPrompt.trim()
                      ? "bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 7H12.25M12.25 7L8.75 3.5M12.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Generate {selectedCount} Image{selectedCount > 1 ? "s" : ""}
                </button>
              </div>
            </>
          )}

          {/* ====== STEP 3: GENERATING ====== */}
          {step === "generating" && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="animate-spin text-purple-600">
                  <path d="M14 2.33333V7M14 21V25.6667M4.62067 7.62L7.86 10.8593M20.14 17.1407L23.3793 20.38M2.33333 14H7M21 14H25.6667M4.62067 20.38L7.86 17.1407M20.14 10.8593L23.3793 7.62" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">Generating Images...</h3>
              <p className="text-sm text-slate-500 mb-6">
                Creating {selectedCount} image{selectedCount > 1 ? "s" : ""} for your listing
              </p>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-3xl font-mono font-bold text-purple-600 tabular-nums">
                  {formatTime(countdown)}
                </span>
                <span className="text-sm text-slate-400">remaining</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Progress text */}
              <p className="text-sm text-slate-500">
                {Math.round(progress)}% complete
              </p>

              {/* Image type pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {selected.map((id) => {
                  const type = IMAGE_TYPES.find((t) => t.id === id);
                  return (
                    <span
                      key={id}
                      className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200"
                    >
                      {type?.icon} {type?.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
