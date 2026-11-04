import { cn } from "@/lib/utils";
import type { SellerProductDetail } from "@/lib/reference-research";

export type AttributeRow = { attribute: string; value: string };

/** Amazon-style two-column attribute grid (Specifications & Features). */
export function SpecificationsFeaturesSection({
  rows,
  className,
  showHeading = true,
  heading = "Specifications & Features",
  compact = false,
  /** preview = two bordered columns (listing preview); panel = one box, lighter grid in optimize UI */
  variant = "preview",
}: {
  rows: AttributeRow[];
  className?: string;
  /** When false, only the attribute grid renders (e.g. inside compare cards). */
  showHeading?: boolean;
  heading?: string;
  compact?: boolean;
  variant?: "preview" | "panel";
}) {
  const filtered = rows.filter((r) => r.attribute?.trim() && r.value?.trim());
  if (filtered.length === 0) return null;
  const splitAt = Math.ceil(filtered.length / 2);
  const columns = [filtered.slice(0, splitAt), filtered.slice(splitAt)];

  const labelClass = compact
    ? "text-[10px] font-bold text-slate-900 shrink-0 max-w-[45%] leading-snug"
    : "text-[11px] sm:text-xs font-bold text-slate-900 shrink-0 max-w-[45%] leading-snug";
  const valueClass = compact
    ? "text-[10px] text-slate-700 text-right leading-snug break-words min-w-0 flex-1"
    : "text-[11px] sm:text-xs text-slate-700 text-right leading-snug break-words min-w-0 flex-1";

  const rowClass = (rowIndex: number, columnLength: number) =>
    cn(
      "flex items-start justify-between gap-3 sm:gap-4",
      variant === "preview" ? "px-4 py-2.5 sm:py-3" : "px-2.5 py-1.5 sm:px-3 sm:py-2",
      rowIndex < columnLength - 1 && "border-b border-slate-100",
    );

  if (variant === "panel") {
    return (
      <div
        className={cn(
          showHeading && "mt-5 pt-5 border-t border-slate-200 space-y-4",
          !showHeading && "space-y-0",
          className,
        )}
      >
        {showHeading ? (
          <h4 className="text-center text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {heading}
          </h4>
        ) : null}
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-100">
            {columns.map((columnRows, colIndex) =>
              columnRows.length > 0 ? (
                <div key={colIndex} className={cn(colIndex > 0 && "border-t sm:border-t-0 border-slate-100")}>
                  {columnRows.map((row, rowIndex) => (
                    <div key={`${colIndex}-${row.attribute}-${rowIndex}`} className={rowClass(rowIndex, columnRows.length)}>
                      <span className={labelClass}>{row.attribute}</span>
                      <span className={valueClass}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        showHeading && "mt-5 pt-5 border-t border-slate-200 space-y-4",
        !showHeading && "space-y-0",
        className,
      )}
    >
      {showHeading ? (
        <h4 className="text-center text-sm sm:text-base font-bold text-slate-900 tracking-tight">
          {heading}
        </h4>
      ) : null}
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
                  className={rowClass(rowIndex, columnRows.length)}
                >
                  <span className={labelClass}>{row.attribute}</span>
                  <span className={valueClass}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}
