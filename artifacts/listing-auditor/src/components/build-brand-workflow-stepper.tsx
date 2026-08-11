import type { ElementType } from "react";
import { Check, Download, FileText, Image as ImageIcon, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildBrandWorkflowStepId = 1 | 2 | 3 | 4 | 5;

export const BUILD_BRAND_WORKFLOW_STEPS: {
  id: BuildBrandWorkflowStepId;
  key: string;
  label: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: 1, key: "upload", label: "UPLOAD", sub: "Upload product images", icon: Upload },
  { id: 2, key: "listing", label: "LISTING", sub: "Create listing content", icon: FileText },
  { id: 3, key: "graphics", label: "GRAPHICS", sub: "Create product graphics", icon: ImageIcon },
  { id: 4, key: "aplus", label: "A+ CONTENT", sub: "Create A+ content", icon: Sparkles },
  { id: 5, key: "export", label: "EXPORT", sub: "Export & publish", icon: Download },
];

export function buildBrandStepCompletedFromCurrentStep(
  currentStep: number | null | undefined,
  status?: string | null,
): Record<BuildBrandWorkflowStepId, boolean> {
  const step = Math.min(5, Math.max(1, currentStep ?? 1)) as BuildBrandWorkflowStepId;
  const complete = status === "complete";
  return {
    1: complete || step > 1,
    2: complete || step > 2,
    3: complete || step > 3,
    4: complete || step > 4,
    5: complete,
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
        "border border-slate-200 bg-white rounded-xl overflow-x-auto flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-stretch min-w-[20rem] w-full">
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
                "flex-1 min-w-[4rem] flex flex-col items-center py-3 gap-0.5 border-b-2 transition-all text-center px-1",
                isActive ? "border-orange-500" : "border-transparent",
                clickable && !isActive && "hover:border-slate-200 cursor-pointer",
                !clickable && "cursor-default",
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  isCompleted || isActive
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-300 text-slate-400",
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide leading-none whitespace-nowrap",
                  isActive ? "text-orange-500" : isCompleted ? "text-orange-400" : "text-slate-400",
                )}
              >
                {s.label}
              </p>
              <p
                className={cn(
                  "text-[10px] leading-tight hidden sm:block",
                  isActive || isCompleted ? "text-slate-600" : "text-slate-400",
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
