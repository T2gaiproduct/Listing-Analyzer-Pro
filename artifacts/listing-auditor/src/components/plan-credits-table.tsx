import {
  buildPlanActivityRows,
  computePlanCreditsFromPlan,
  formatPlanAllocationDisplayValue,
  type CreditRuleLike,
  type PlanRowForAllocations,
} from "@/lib/plan-credits";
import { cn } from "@/lib/utils";

export function PlanCreditsTable({
  plan,
  creditRules = [],
  compact = false,
}: {
  plan: PlanRowForAllocations;
  creditRules?: CreditRuleLike[];
  compact?: boolean;
}) {
  const activityRows = buildPlanActivityRows(plan);
  const totalCredits = computePlanCreditsFromPlan(plan, creditRules).totalCredits;

  return (
    <div className={cn("space-y-2.5", compact ? "mb-4" : "mb-5")}>
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wide border-b border-slate-100 pb-1.5">
        <span>Item</span>
        <span>Credits / Mo</span>
      </div>
      {activityRows.map((row) => (
        <div key={row.label} className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{row.label}</span>
          <span className={cn("font-semibold", row.color)}>
            {formatPlanAllocationDisplayValue(row.value)}
          </span>
        </div>
      ))}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 font-medium">Total Monthly Credits</span>
          <span className="font-bold text-slate-900">{totalCredits.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
