import type { ReferenceIntelligenceDecision, ReferenceIntelligenceRow } from "@/lib/reference-research";
import { cn } from "@/lib/utils";

export const REFERENCE_INTELLIGENCE_DECISION_LABELS: Record<ReferenceIntelligenceDecision, string> = {
  safe_research: "Safe research signal",
  seller_confirmation: "Seller confirmation",
  ask_seller: "Ask seller",
  product_evidence_required: "Product evidence req.",
  research_only: "Research only",
};

export const REFERENCE_INTELLIGENCE_DECISION_CLASS: Record<ReferenceIntelligenceDecision, string> = {
  safe_research: "text-emerald-700 bg-emerald-50 border-emerald-200",
  seller_confirmation: "text-amber-700 bg-amber-50 border-amber-200",
  ask_seller: "text-amber-700 bg-amber-50 border-amber-200",
  product_evidence_required: "text-red-600 bg-red-50 border-red-200",
  research_only: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export function ReferenceIntelligenceTable({
  rows,
  compact = false,
  /** Listing preview: attribute + notes only (no internal allowed-use / decision columns). */
  variant = "research",
}: {
  rows: ReferenceIntelligenceRow[];
  compact?: boolean;
  variant?: "research" | "listingPreview";
}) {
  if (rows.length === 0) return null;

  const showComplianceColumns = variant === "research";

  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full text-left text-[10px]",
          showComplianceColumns ? "min-w-[640px]" : "min-w-[320px]",
        )}
      >
        <thead>
          <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wide">
            <th className={cn("px-3 py-2 font-semibold", showComplianceColumns ? "w-[18%]" : "w-[28%]")}>
              Attribute
            </th>
            <th className={cn("px-3 py-2 font-semibold", showComplianceColumns ? "w-[32%]" : "w-[72%]")}>
              Reference pattern / notes
            </th>
            {showComplianceColumns && (
              <>
                <th className="px-3 py-2 font-semibold w-[32%]">Allowed use</th>
                <th className="px-3 py-2 font-semibold w-[18%]">Decision</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attribute} className="border-b border-slate-50 align-top">
              <td className="px-3 py-2.5 font-medium text-slate-800">{row.attribute}</td>
              <td className="px-3 py-2.5 text-slate-600 leading-relaxed whitespace-pre-wrap">
                {row.referencePatternNotes}
              </td>
              {showComplianceColumns && (
                <>
                  <td className="px-3 py-2.5 text-slate-500 leading-relaxed">{row.allowedUse}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        REFERENCE_INTELLIGENCE_DECISION_CLASS[row.decision],
                      )}
                    >
                      {REFERENCE_INTELLIGENCE_DECISION_LABELS[row.decision]}
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
