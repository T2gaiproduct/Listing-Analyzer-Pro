import type { ElementType } from "react";
import { FileSearch, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuditListingDetailTab = "overview" | "audit_result";

export const AUDIT_LISTING_DETAIL_TABS: {
  id: AuditListingDetailTab;
  label: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: "overview", label: "OVERVIEW", sub: "Product summary", icon: LayoutDashboard },
  { id: "audit_result", label: "AUDIT RESULT", sub: "Listing scores & fixes", icon: FileSearch },
];

interface AuditListingDetailTabsProps {
  activeTab: AuditListingDetailTab;
  onTabChange: (tab: AuditListingDetailTab) => void;
  className?: string;
}

export function AuditListingDetailTabs({
  activeTab,
  onTabChange,
  className,
}: AuditListingDetailTabsProps) {
  return (
    <div
      className={cn(
        "border border-border bg-card rounded-lg overflow-x-auto flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-stretch min-w-[20rem] w-full max-w-2xl">
        {AUDIT_LISTING_DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 min-w-[9rem] flex flex-col items-center py-2 gap-0.5 border-b-2 transition-all text-center px-2 cursor-pointer",
                isActive ? "border-orange-500" : "border-transparent hover:border-border",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                  isActive
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-card border-border text-muted-foreground",
                )}
              >
                <TabIcon className="w-3 h-3" strokeWidth={2.25} />
              </div>
              <p
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap",
                  isActive ? "text-orange-500" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </p>
              <p
                className={cn(
                  "text-[9px] leading-tight hidden sm:block",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {tab.sub}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
