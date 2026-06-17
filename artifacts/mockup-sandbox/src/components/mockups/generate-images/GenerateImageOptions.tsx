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

export function GenerateImageOptions() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedCount = selected.length;
  const customSelected = selected.includes("custom");
  const canGenerate = selectedCount > 0 && (!customSelected || customPrompt.trim().length > 0);

  const handleGenerate = () => {
    if (!canGenerate) return;
    setIsGenerating(true);
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
        setIsGenerating(false);
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
              <p className="text-sm text-slate-400 mt-0.5">Select image types to generate</p>
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
          {!isGenerating ? (
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

              {/* Custom prompt area */}
              {customSelected && (
                <div className="mt-4 p-4 rounded-xl border-2 border-purple-200 bg-purple-50/20">
                  <label className="text-sm font-semibold text-slate-900 block mb-2">
                    Custom Prompt <span className="text-slate-400 font-normal">(required)</span>
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe exactly what you want the custom image to look like. Be specific about scene, lighting, composition, and background."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">{customPrompt.length} characters</p>
                </div>
              )}

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
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2 ${
                    canGenerate
                      ? "bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 7H12.25M12.25 7L8.75 3.5M12.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Generate {selectedCount > 0 ? `${selectedCount} Image${selectedCount > 1 ? "s" : ""}` : ""}
                </button>
              </div>
            </>
          ) : (
            /* Generating State */
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
