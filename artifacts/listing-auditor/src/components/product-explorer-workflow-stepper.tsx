import type { ElementType } from "react";
import { Check, FileText, Image as ImageIcon, LayoutDashboard, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductExplorerWorkflowStepId = 1 | 2 | 3 | 4 | 5;

export const PRODUCT_EXPLORER_WORKFLOW_STEPS: {
  id: ProductExplorerWorkflowStepId;
  key: string;
  label: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: 1, key: "upload", label: "UPLOAD", sub: "Upload product images", icon: Upload },
  { id: 2, key: "overview", label: "OVERVIEW", sub: "Product summary", icon: LayoutDashboard },
  { id: 3, key: "listing", label: "LISTING", sub: "Create listing content", icon: FileText },
  { id: 4, key: "graphics", label: "GRAPHICS", sub: "Create product graphics", icon: ImageIcon },
  { id: 5, key: "aplus", label: "A+ CONTENT", sub: "Create A+ content", icon: Sparkles },
];

/** Map API audit `currentStep` (1–5) to Product Explorer UI step (1–5). Step 1 lands on Overview. */
export function apiStepToProductExplorerStep(
  currentStep: number | null | undefined,
): ProductExplorerWorkflowStepId {
  const apiStep = Math.min(5, Math.max(1, currentStep ?? 1));
  if (apiStep === 1) return 2;
  if (apiStep >= 5) return 5;
  return (apiStep + 1) as ProductExplorerWorkflowStepId;
}

/** Returns API step to persist, or null for local-only steps (Overview). */
export function productExplorerStepToApiStep(
  peStep: ProductExplorerWorkflowStepId,
): number | null {
  if (peStep === 1) return 1;
  if (peStep === 2) return null;
  if (peStep === 5) return 4;
  return peStep - 1;
}

export function productExplorerStepCompletedFromCurrentStep(
  currentStep: number | null | undefined,
  status?: string | null,
): Record<ProductExplorerWorkflowStepId, boolean> {
  const apiStep = Math.min(5, Math.max(1, currentStep ?? 1));
  const complete = status === "complete";
  return {
    1: complete || apiStep > 1,
    2: complete || apiStep > 1,
    3: complete || apiStep > 2,
    4: complete || apiStep > 3,
    5: complete || apiStep >= 4,
  };
}

interface ProductExplorerWorkflowStepperProps {
  activeStep: ProductExplorerWorkflowStepId;
  stepCompleted?: Partial<Record<ProductExplorerWorkflowStepId, boolean>>;
  onStepClick?: (stepId: ProductExplorerWorkflowStepId) => void;
  className?: string;
}

export function ProductExplorerWorkflowStepper({
  activeStep,
  stepCompleted = {},
  onStepClick,
  className,
}: ProductExplorerWorkflowStepperProps) {
  return (
    <div
      className={cn(
        "border border-slate-200 bg-white rounded-xl overflow-x-auto flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-stretch min-w-[24rem] w-full">
        {PRODUCT_EXPLORER_WORKFLOW_STEPS.map((s) => {
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
