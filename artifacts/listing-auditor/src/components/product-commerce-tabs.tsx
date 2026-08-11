import { cn } from "@/lib/utils";
import {
  PRODUCT_COMMERCE_TABS,
  type ProductCommerceTabId,
} from "@/components/product-explorer-workflow-stepper";
import { ProductMarketplacesTab } from "@/components/product-marketplaces-tab";
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";

export function ProductCommerceTabs({
  activeTab,
  onTabChange,
  productId,
  source,
  liveMarketplaceCount = 0,
}: {
  activeTab: ProductCommerceTabId;
  onTabChange: (tab: ProductCommerceTabId) => void;
  productId: number;
  source: string;
  liveMarketplaceCount?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRODUCT_COMMERCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "h-8 px-3.5 rounded-lg text-[11px] font-medium border transition-colors",
              activeTab === tab.id
                ? "bg-orange-50 text-orange-700 border-orange-200 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            )}
          >
            {tab.label}
            {tab.id === "marketplaces" && liveMarketplaceCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.125rem] h-4 px-1 rounded-full bg-emerald-100 text-[9px] font-semibold text-emerald-700">
                {liveMarketplaceCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "marketplaces" && (
        <ProductMarketplacesTab productId={productId} source={source} enabled />
      )}
      {activeTab === "orders" && (
        <ProductOrdersTab productId={productId} source={source} enabled />
      )}
      {activeTab === "sales" && (
        <ProductSalesTab productId={productId} source={source} enabled />
      )}
    </div>
  );
}
