import {
  buildPlanActivityRows,
  formatPlanCreditAllowanceValue,
  formatPlanMonthlyCreditTotal,
  resolvePlanAllocationCounts,
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
  const counts = resolvePlanAllocationCounts(plan, creditRules);
  const activityRows = buildPlanActivityRows(plan, creditRules);
  const totalLabel = formatPlanMonthlyCreditTotal(counts);

  return (
    <div className={cn("space-y-2.5", compact ? "mb-4" : "mb-5")}>
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wide border-b border-slate-100 pb-1.5">
        <span>Item</span>
        <span>Credits / Mo</span>
      </div>
      {activityRows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center text-sm">
          <span className="text-slate-600 min-w-0">{row.label}</span>
          <span className={cn("font-semibold shrink-0 tabular-nums", row.color)}>
            {formatPlanCreditAllowanceValue(row.value)}
          </span>
        </div>
      ))}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center text-sm">
          <span className="text-slate-600 font-medium min-w-0">Total Monthly Credits</span>
          <span className="font-bold text-slate-900 shrink-0 tabular-nums">{totalLabel}</span>
        </div>
      </div>
    </div>
  );
}
