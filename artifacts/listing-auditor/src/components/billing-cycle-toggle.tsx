import { cn } from "@/lib/utils";

export function BillingCycleToggle({
  yearly,
  onChange,
  savingsPercent,
  className,
}: {
  yearly: boolean;
  onChange: (yearly: boolean) => void;
  savingsPercent?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-3 bg-slate-100 rounded-full p-1", className)}>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "px-5 py-2 rounded-full text-sm font-semibold transition-all",
          !yearly ? "bg-white shadow text-slate-900" : "text-slate-500",
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2",
          yearly ? "bg-white shadow text-slate-900" : "text-slate-500",
        )}
      >
        Yearly
        {savingsPercent != null && savingsPercent > 0 && (
          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">
            Save {savingsPercent}%
          </span>
        )}
      </button>
    </div>
  );
}
