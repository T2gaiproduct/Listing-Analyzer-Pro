import { useEffect, useRef, type ElementType } from "react";
import { Check, Download, Eye, FileText, Image as ImageIcon, PackageSearch, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildBrandWorkflowStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** UI step 1 (SELECT) is not persisted; upload maps to API 1–4; preview → API 5; export → API 6. */
export function uiStepToApiStep(uiStep: BuildBrandWorkflowStepId): number {
  if (uiStep >= 7) return 6;
  if (uiStep >= 6) return 5;
  return Math.max(1, Math.min(4, uiStep - 1));
}

export function apiStepToUiStep(apiStep: number | null | undefined): BuildBrandWorkflowStepId {
  const raw = Math.max(1, apiStep ?? 1);
  if (raw >= 6) return 7;
  if (raw >= 5) return 6;
  const n = Math.min(4, raw);
  return (n + 1) as BuildBrandWorkflowStepId;
}

export const BUILD_BRAND_WORKFLOW_STEPS: {
  id: BuildBrandWorkflowStepId;
  key: string;
  label: string;
  shortLabel: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: 1, key: "select", label: "SELECT", shortLabel: "Select", sub: "Find existing product", icon: PackageSearch },
  { id: 2, key: "upload", label: "UPLOAD", shortLabel: "Upload", sub: "Upload product images", icon: Upload },
  { id: 3, key: "listing", label: "LISTING", shortLabel: "Listing", sub: "Create listing content", icon: FileText },
  { id: 4, key: "graphics", label: "GRAPHICS", shortLabel: "Graphics", sub: "Create product graphics", icon: ImageIcon },
  { id: 5, key: "aplus", label: "A+ CONTENT", shortLabel: "A+", sub: "Create A+ content", icon: Sparkles },
  { id: 6, key: "listing_preview", label: "LISTING PREVIEW", shortLabel: "Preview", sub: "Amazon-style preview", icon: Eye },
  { id: 7, key: "export", label: "EXPORT", shortLabel: "Export", sub: "CSV & Excel download", icon: Download },
];

export function buildBrandStepCompletedFromCurrentStep(
  currentStep: number | null | undefined,
  status?: string | null,
): Record<BuildBrandWorkflowStepId, boolean> {
  const apiStep = Math.min(6, Math.max(1, currentStep ?? 1));
  const uiStep = apiStepToUiStep(apiStep);
  const complete = status === "complete";
  return {
    1: complete || uiStep > 1,
    2: complete || uiStep > 2,
    3: complete || uiStep > 3,
    4: complete || uiStep > 4,
    5: complete || uiStep > 5,
    6: complete || uiStep > 6,
    7: complete || apiStep >= 6,
  };
}

interface BuildBrandWorkflowStepperProps {
  activeStep: BuildBrandWorkflowStepId;
  stepCompleted?: Partial<Record<BuildBrandWorkflowStepId, boolean>>;
  onStepClick?: (stepId: BuildBrandWorkflowStepId) => void;
  className?: string;
}

export function BuildBrandWorkflowStepper({
  activeStep,
  stepCompleted = {},
  onStepClick,
  className,
}: BuildBrandWorkflowStepperProps) {
  const activeStepRef = useRef<HTMLButtonElement>(null);
  const activeMeta = BUILD_BRAND_WORKFLOW_STEPS.find((s) => s.id === activeStep) ?? BUILD_BRAND_WORKFLOW_STEPS[0];
  const progressPct = Math.round((activeStep / BUILD_BRAND_WORKFLOW_STEPS.length) * 100);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) return;
    activeStepRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeStep]);

  return (
    <div
      className={cn(
        "border border-border bg-card rounded-xl overflow-hidden flex-shrink-0",
        className,
      )}
    >
      <div className="px-4 py-2.5 border-b border-border sm:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Step {activeStep} of {BUILD_BRAND_WORKFLOW_STEPS.length}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{activeMeta.sub}</p>
        </div>
        <p className="text-sm font-semibold text-foreground mt-0.5">{activeMeta.shortLabel}</p>
        <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden" aria-hidden>
          <div
            className="h-full bg-orange-500 rounded-full transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div
        className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-x-visible"
      >
        <div className="flex items-stretch w-max min-w-full sm:w-full sm:min-w-0 px-1 sm:px-0">
          {BUILD_BRAND_WORKFLOW_STEPS.map((s) => {
            const isActive = activeStep === s.id;
            const isCompleted = !isActive && Boolean(stepCompleted[s.id]);
            const clickable = Boolean(onStepClick);

            return (
              <button
                key={s.id}
                ref={isActive ? activeStepRef : undefined}
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(s.id)}
                className={cn(
                  "flex-shrink-0 w-[4.25rem] sm:flex-1 sm:min-w-0 flex flex-col items-center py-2.5 sm:py-2.5 xl:py-3 gap-0.5 border-b-2 transition-all text-center px-0.5 snap-center",
                  isActive ? "border-orange-500" : "border-transparent",
                  clickable && !isActive && "hover:border-border cursor-pointer",
                  !clickable && "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                    isCompleted || isActive
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-card border-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <p
                  className={cn(
                    "text-[9px] sm:hidden font-semibold leading-tight text-center max-w-full px-0.5 line-clamp-2",
                    isActive ? "text-orange-500" : isCompleted ? "text-orange-400" : "text-muted-foreground",
                  )}
                >
                  {s.shortLabel}
                </p>
                <p
                  className={cn(
                    "hidden sm:block text-[9px] xl:text-[10px] font-bold uppercase tracking-wide leading-tight px-0.5",
                    isActive ? "text-orange-500" : isCompleted ? "text-orange-400" : "text-muted-foreground",
                  )}
                >
                  <span className="xl:hidden">{s.shortLabel}</span>
                  <span className="hidden xl:inline">{s.label}</span>
                </p>
                <p
                  className={cn(
                    "text-[10px] leading-tight hidden xl:block px-1",
                    isActive || isCompleted ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  {s.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
