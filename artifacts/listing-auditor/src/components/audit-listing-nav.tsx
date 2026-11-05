import { ChevronDown, ClipboardList, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImportFromLinkForAuditListings } from "@/lib/import-from-link-return";
import {
  isOpenedFromAuditInDetail,
  isOpenedFromAuditListingsHistory,
} from "@/lib/audit-in-detail-nav";

export const AUDIT_LISTING_HOME_HREF = "/audit-listings";
export const AUDIT_IN_DETAIL_HREF = "/audit-in-detail";

function isAuditDetailPath(location: string): boolean {
  return /^\/audits\/\d+$/.test(location);
}

export function isAuditListingNavActive(location: string, search = ""): boolean {
  if (location === AUDIT_LISTING_HOME_HREF) return true;
  if (location === "/audits/import-from-link" && isImportFromLinkForAuditListings(search)) {
    return true;
  }
  if (isAuditDetailPath(location) && isOpenedFromAuditListingsHistory(search)) {
    return true;
  }
  return false;
}

export function isAuditInDetailNavActive(location: string, search = ""): boolean {
  if (location === AUDIT_IN_DETAIL_HREF) return true;
  if (isAuditDetailPath(location) && isOpenedFromAuditInDetail(search)) return true;
  return false;
}

export function isAuditListingSectionPath(location: string, search = ""): boolean {
  return isAuditListingNavActive(location, search) || isAuditInDetailNavActive(location, search);
}

export function isAuditListingHomePath(location: string, search = ""): boolean {
  return isAuditListingNavActive(location, search) && !isAuditInDetailNavActive(location, search);
}

type AuditListingNavGroupProps = {
  location: string;
  search?: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
  variant?: "sidebar" | "mobile";
};

export function AuditListingNavGroup({
  location,
  search = "",
  expanded,
  onToggle,
  onNavigate,
  variant = "sidebar",
}: AuditListingNavGroupProps) {
  const isOnHome = isAuditListingHomePath(location, search);
  const isMobile = variant === "mobile";
  const childActive = isAuditInDetailNavActive(location, search);

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors",
          isOnHome
            ? "bg-orange-500 text-white shadow-sm"
            : isMobile
              ? "hover:bg-slate-100"
              : "hover:bg-sidebar-accent/50",
        )}
      >
        <button
          type="button"
          onClick={() => {
            onNavigate(AUDIT_LISTING_HOME_HREF);
            if (!expanded) onToggle();
          }}
          className={cn(
            "flex flex-1 items-center gap-1.5 text-left min-w-0",
            isMobile ? "px-3 py-2.5 min-h-9 text-xs" : "px-2.5 py-2 text-[11px]",
            isOnHome
              ? "font-medium text-white"
              : isMobile
                ? "text-slate-600 font-normal"
                : "text-sidebar-foreground font-normal",
          )}
        >
          <FileSearch
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              isMobile ? "w-4 h-4" : "",
              isOnHome ? "text-white" : isMobile ? "" : "text-sidebar-foreground/75",
            )}
          />
          <span className="truncate flex-1 min-w-0">Audit Listing</span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse Audit Listing menu" : "Expand Audit Listing menu"}
          className={cn(
            "shrink-0 p-1.5 rounded-md",
            isOnHome ? "text-white/90 hover:bg-white/10" : "opacity-70 hover:opacity-100",
          )}
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className={cn("space-y-0.5", isMobile ? "pl-2" : "pl-1 ml-1 border-l border-sidebar-border/60")}>
          <button
            type="button"
            onClick={() => onNavigate(AUDIT_IN_DETAIL_HREF)}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg text-left transition-colors",
              isMobile ? "px-3 py-2 text-xs min-h-8" : "px-2.5 py-1.5 text-[11px] ml-2",
              childActive
                ? "bg-orange-500 text-white font-medium shadow-sm"
                : isMobile
                  ? "text-slate-600 hover:bg-slate-100"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <ClipboardList
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                childActive ? "text-white" : isMobile ? "text-slate-400" : "text-sidebar-foreground/50",
              )}
            />
            <span className="truncate flex-1">Audit in Detail</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function AuditListingNavCollapsed({
  location,
  search = "",
  onNavigate,
}: {
  location: string;
  search?: string;
  onNavigate: (href: string) => void;
}) {
  const isSectionActive = isAuditListingSectionPath(location, search);

  return (
    <button
      type="button"
      onClick={() => onNavigate(
        isAuditInDetailNavActive(location, search)
          ? AUDIT_IN_DETAIL_HREF
          : AUDIT_LISTING_HOME_HREF,
      )}
      className={cn(
        "w-full flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
        isSectionActive
          ? "bg-orange-500 text-white shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
      aria-label="Audit Listing"
    >
      <FileSearch className="w-4 h-4" />
    </button>
  );
}
