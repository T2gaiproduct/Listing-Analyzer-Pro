import { useState } from "react";
import { Boxes, ShoppingCart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";

type MiscPanel = "details" | "orders" | "sales";

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

function MiscSubTabs({
  active,
  onChange,
}: {
  active: MiscPanel;
  onChange: (panel: MiscPanel) => void;
}) {
  const tabs: { id: MiscPanel; label: string; icon: typeof Boxes }[] = [
    { id: "details", label: "Product details", icon: Boxes },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "sales", label: "Sales", icon: TrendingUp },
  ];
  return (
    <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors -mb-px shrink-0 inline-flex items-center gap-1.5",
              active === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200",
            )}
          >
            <Icon className="w-3.5 h-3.5 opacity-70" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProductMiscellaneousTab({
  productId,
  productSource,
  productName,
  sku,
  asin,
  sourceType,
  brandName,
  category,
  targetKeywords,
}: {
  productId: number;
  productSource: string;
  productName: string;
  sku?: string | null;
  asin?: string | null;
  sourceType?: string | null;
  brandName?: string | null;
  category?: string | null;
  targetKeywords?: string[] | null;
}) {
  const [panel, setPanel] = useState<MiscPanel>("details");
  const keywords = (targetKeywords ?? []).filter((k) => k?.trim()).join(", ");

  return (
    <div className="space-y-4 min-w-0">
      <MiscSubTabs active={panel} onChange={setPanel} />

      {panel === "details" && (
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Boxes className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Product details</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Identifiers and catalog metadata for {productName}.
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
        </div>
      )}

      {panel === "orders" && (
        <div className="min-w-0 pt-1">
          <ProductOrdersTab productId={productId} source={productSource} enabled />
        </div>
      )}

      {panel === "sales" && (
        <div className="min-w-0 pt-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ProductSalesTab productId={productId} source={productSource} enabled />
        </div>
      )}
    </div>
  );
}
