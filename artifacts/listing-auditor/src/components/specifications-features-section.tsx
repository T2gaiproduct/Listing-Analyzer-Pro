import { cn } from "@/lib/utils";
import type { SellerProductDetail } from "@/lib/reference-research";

/** Amazon-style two-column attribute grid (Specifications & Features). */
export function SpecificationsFeaturesSection({
  rows,
  className,
}: {
  rows: SellerProductDetail[];
  className?: string;
}) {
  const filtered = rows.filter((r) => r.attribute?.trim() && r.value?.trim());
  if (filtered.length === 0) return null;
  const splitAt = Math.ceil(filtered.length / 2);
  const columns = [filtered.slice(0, splitAt), filtered.slice(splitAt)];

  return (
    <div className={cn("mt-5 pt-5 border-t border-slate-200 space-y-4", className)}>
      <h4 className="text-center text-sm sm:text-base font-bold text-slate-900 tracking-tight">
        Specifications &amp; Features
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {columns.map((columnRows, colIndex) => (
          columnRows.length > 0 ? (
            <div
              key={colIndex}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
            >
              {columnRows.map((row, rowIndex) => (
                <div
                  key={`${colIndex}-${row.attribute}-${rowIndex}`}
                  className={cn(
                    "flex items-start justify-between gap-6 px-4 py-2.5 sm:py-3",
                    rowIndex < columnRows.length - 1 && "border-b border-slate-100",
                  )}
                >
                  <span className="text-[11px] sm:text-xs font-bold text-slate-900 shrink-0 max-w-[45%] leading-snug">
                    {row.attribute}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-700 text-right leading-snug break-words min-w-0 flex-1">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}
