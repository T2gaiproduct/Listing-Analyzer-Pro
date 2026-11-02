import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductMarketplacesTab } from "@/components/product-marketplaces-tab";
import { canExportListingSource } from "@/components/listing-export-button";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import type { ContentVariantRow } from "@/components/listing-marketplace-content-panel";
import { ProductMultiMarketplaceExcelPanel } from "@/components/product-multi-marketplace-excel-panel";

type ExportPanel = "marketplaces" | "excel";

function ExportStepSubTabs({
  active,
  onChange,
}: {
  active: ExportPanel;
  onChange: (panel: ExportPanel) => void;
}) {
  const tabs: { id: ExportPanel; label: string }[] = [
    { id: "marketplaces", label: "Marketplaces" },
    { id: "excel", label: "Excel export" },
  ];
  return (
    <div className="flex gap-0 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors -mb-px shrink-0",
            active === tab.id
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ProductExportTab({
  productId,
  auditId,
  productSource,
  productName,
  contentVariants,
  contentMarketplaces,
  canPublishMarketplaces,
}: {
  productId: number;
  auditId: number;
  productSource: string;
  productName?: string;
  contentVariants: ContentVariantRow[];
  contentMarketplaces: ContentMarketplaceOption[];
  canPublishMarketplaces?: boolean;
}) {
  const [panel, setPanel] = useState<ExportPanel>("marketplaces");
  const excelEnabled = canExportListingSource(productSource) && auditId > 0;

  return (
    <div className="space-y-4 min-w-0">
      <ExportStepSubTabs active={panel} onChange={setPanel} />

      {panel === "marketplaces" && (
        <div className="min-w-0 pt-1">
          <ProductMarketplacesTab
            productId={productId}
            auditId={auditId}
            source={productSource}
            enabled
            canPublish={canPublishMarketplaces}
          />
        </div>
      )}

      {panel === "excel" && (
        <div className="min-w-0 pt-1">
          {excelEnabled ? (
            <ProductMultiMarketplaceExcelPanel
              auditId={auditId}
              productName={productName}
              contentVariants={contentVariants}
              contentMarketplaces={contentMarketplaces}
            />
          ) : (
            <p className="text-[11px] text-slate-500 py-6 text-center px-4">
              Excel export is available for listing and audit products with optimized content.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
