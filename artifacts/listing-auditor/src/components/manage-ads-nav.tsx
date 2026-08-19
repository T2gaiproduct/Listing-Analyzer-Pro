import { ChevronDown, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MANAGE_ADS_HOME_HREF,
  MANAGE_ADS_NAV_ITEMS,
  isManageAdsConsolePath,
  isManageAdsHomePath,
  isManageAdsPath,
} from "@/lib/ads-nav";

type ManageAdsNavGroupProps = {
  location: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
  variant?: "sidebar" | "mobile";
};

export function ManageAdsNavGroup({
  location,
  expanded,
  onToggle,
  onNavigate,
  variant = "sidebar",
}: ManageAdsNavGroupProps) {
  const isAdsActive = isManageAdsPath(location);
  const isOnHome = isManageAdsHomePath(location);
  const isMobile = variant === "mobile";

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors",
          isOnHome
            ? isMobile
              ? "bg-orange-500 text-white shadow-sm"
              : "bg-orange-500 text-white shadow-sm"
            : isMobile
              ? "hover:bg-slate-100"
              : "hover:bg-sidebar-accent/50",
        )}
      >
        <button
          type="button"
          onClick={() => {
            onNavigate(MANAGE_ADS_HOME_HREF);
            if (!expanded) onToggle();
          }}
          className={cn(
            "flex flex-1 items-center gap-2 text-left min-w-0",
            isMobile ? "px-3 py-2.5 min-h-9 text-xs" : "px-2.5 py-2 text-[11px]",
            isOnHome
              ? "font-medium text-white"
              : isMobile
                ? "text-slate-600 font-normal"
                : "text-sidebar-foreground/60 font-normal",
          )}
        >
          <Megaphone
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              isMobile ? "w-4 h-4" : "",
              isOnHome ? "text-white" : isMobile ? "" : "text-sidebar-foreground/40",
            )}
          />
          <span className="truncate">Manage Ads</span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse Manage Ads menu" : "Expand Manage Ads menu"}
          className={cn(
            "shrink-0 p-1.5 rounded-md",
            isOnHome ? "text-white/90 hover:bg-white/10" : "opacity-70 hover:opacity-100",
          )}
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className={cn("space-y-0.5", isMobile ? "pl-2" : "pl-1 ml-1")}>
          {MANAGE_ADS_NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
            const childActive =
              location === href || location.startsWith(`${href}/`);
            return (
              <button
                key={href}
                type="button"
                onClick={() => onNavigate(href)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg text-left transition-colors",
                  isMobile ? "px-3 py-2 text-xs min-h-8" : "px-2.5 py-1.5 text-[11px]",
                  childActive
                    ? "bg-teal-50 text-teal-800 font-medium"
                    : isMobile
                      ? "text-slate-600 hover:bg-slate-100"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    childActive ? "text-teal-600" : isMobile ? "text-slate-400" : "text-sidebar-foreground/40",
                  )}
                />
                <span className="truncate flex-1">{label}</span>
                {badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-teal-700 text-white px-1.5 py-0.5 rounded shrink-0">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ManageAdsNavCollapsed({
  location,
  onNavigate,
}: {
  location: string;
  onNavigate: (href: string) => void;
}) {
  const isAdsActive =
    isManageAdsPath(location)
    || location === "/ads/new"
    || /^\/ads\/\d+$/.test(location);

  return (
    <button
      type="button"
      onClick={() => onNavigate(MANAGE_ADS_HOME_HREF)}
      className={cn(
        "w-full flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
        isAdsActive
          ? "bg-orange-500 text-white shadow-sm"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
      aria-label="Manage Ads home"
    >
      <Megaphone className="w-4 h-4" />
    </button>
  );
}
