import { Boxes } from "lucide-react";

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 shrink-0">
        {label}
      </span>
      <span className="text-[11px] text-slate-800 sm:text-right break-words">{text}</span>
    </div>
  );
}

export function ProductMiscellaneousTab({
  productId,
  productName,
  sku,
  asin,
  sourceType,
  brandName,
  category,
  targetKeywords,
}: {
  productId: number;
  productName: string;
  sku?: string | null;
  asin?: string | null;
  sourceType?: string | null;
  brandName?: string | null;
  category?: string | null;
  targetKeywords?: string[] | null;
}) {
  const keywords = (targetKeywords ?? []).filter((k) => k?.trim()).join(", ");

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Boxes className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Miscellaneous</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Extra product identifiers and catalog details for {productName}.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-1">
        <DetailRow label="Product ID" value={String(productId)} />
        <DetailRow label="SKU" value={sku} />
        <DetailRow label="ASIN / platform ID" value={asin} />
        <DetailRow label="Source" value={sourceType} />
        <DetailRow label="Brand" value={brandName} />
        <DetailRow label="Category" value={category} />
        <DetailRow label="Target keywords" value={keywords || null} />
      </div>

      <p className="text-[10px] text-slate-500 text-center px-2">
        More miscellaneous fields (custom attributes, internal notes) can be added here as the workflow grows.
      </p>
    </div>
  );
}
