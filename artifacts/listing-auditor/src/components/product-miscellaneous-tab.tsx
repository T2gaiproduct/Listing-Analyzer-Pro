import { useState } from "react";
import { ShoppingCart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";

type MiscPanel = "orders" | "sales";

function MiscSubTabs({
  active,
  onChange,
}: {
  active: MiscPanel;
  onChange: (panel: MiscPanel) => void;
}) {
  const tabs: { id: MiscPanel; label: string; icon: typeof ShoppingCart }[] = [
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
}: {
  productId: number;
  productSource: string;
}) {
  const [panel, setPanel] = useState<MiscPanel>("orders");

  return (
    <div className="space-y-4 min-w-0">
      <MiscSubTabs active={panel} onChange={setPanel} />

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
