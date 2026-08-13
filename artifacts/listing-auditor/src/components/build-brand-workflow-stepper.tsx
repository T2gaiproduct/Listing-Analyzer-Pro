import type { ElementType } from "react";
import { Check, FileText, Image as ImageIcon, PackageSearch, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildBrandWorkflowStepId = 1 | 2 | 3 | 4 | 5;

/** UI step 1 (SELECT) is not persisted; upload onward maps to API steps 1–4. */
export function uiStepToApiStep(uiStep: BuildBrandWorkflowStepId): number {
  return Math.max(1, Math.min(4, uiStep - 1));
}

export function apiStepToUiStep(apiStep: number | null | undefined): BuildBrandWorkflowStepId {
  const raw = Math.max(1, apiStep ?? 1);
  // Legacy audits saved on the removed Export step (API 5) land on A+ Content.
  const n = Math.min(4, raw >= 5 ? 4 : raw);
  return (n + 1) as BuildBrandWorkflowStepId;
}

export const BUILD_BRAND_WORKFLOW_STEPS: {
  id: BuildBrandWorkflowStepId;
  key: string;
  label: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: 1, key: "select", label: "SELECT", sub: "Find existing product", icon: PackageSearch },
  { id: 2, key: "upload", label: "UPLOAD", sub: "Upload product images", icon: Upload },
  { id: 3, key: "listing", label: "LISTING", sub: "Create listing content", icon: FileText },
  { id: 4, key: "graphics", label: "GRAPHICS", sub: "Create product graphics", icon: ImageIcon },
  { id: 5, key: "aplus", label: "A+ CONTENT", sub: "Create A+ content", icon: Sparkles },
];

export function buildBrandStepCompletedFromCurrentStep(
  currentStep: number | null | undefined,
  status?: string | null,
): Record<BuildBrandWorkflowStepId, boolean> {
  const apiStep = Math.min(4, Math.max(1, currentStep ?? 1));
  const uiStep = apiStepToUiStep(apiStep);
  const complete = status === "complete";
  return {
    1: complete || uiStep > 1,
    2: complete || uiStep > 2,
    3: complete || uiStep > 3,
    4: complete || uiStep > 4,
    5: complete || apiStep >= 4,
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
  return (
    <div
      className={cn(
        "border border-border bg-card rounded-xl overflow-x-auto flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-stretch min-w-[24rem] w-full">
        {BUILD_BRAND_WORKFLOW_STEPS.map((s) => {
          const isActive = activeStep === s.id;
          const isCompleted = !isActive && Boolean(stepCompleted[s.id]);
          const clickable = Boolean(onStepClick);

          return (
            <button
              key={s.id}
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(s.id)}
              className={cn(
                "flex-1 min-w-[3.5rem] flex flex-col items-center py-3 gap-0.5 border-b-2 transition-all text-center px-1",
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
                  "text-[10px] font-bold uppercase tracking-wide leading-none whitespace-nowrap",
                  isActive ? "text-orange-500" : isCompleted ? "text-orange-400" : "text-muted-foreground",
                )}
              >
                {s.label}
              </p>
              <p
                className={cn(
                  "text-[10px] leading-tight hidden sm:block",
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
  );
}
