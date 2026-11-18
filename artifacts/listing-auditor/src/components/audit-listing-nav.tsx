import { FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImportFromLinkForAuditListings } from "@/lib/import-from-link-return";
import {
  isOpenedFromAuditInDetail,
  isOpenedFromAuditListingsHistory,
} from "@/lib/audit-in-detail-nav";
import { isAuditListingWorkflowPath } from "@/lib/audit-listing-workflow";

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
  return (
    isAuditListingNavActive(location, search)
    || isAuditInDetailNavActive(location, search)
    || isAuditListingWorkflowPath(location, search)
  );
}

export function isAuditListingHomePath(location: string, search = ""): boolean {
  return isAuditListingNavActive(location, search) && !isAuditInDetailNavActive(location, search);
}

type AuditListingNavGroupProps = {
  location: string;
  search?: string;
  onNavigate: (href: string) => void;
  variant?: "sidebar" | "mobile";
};

export function AuditListingNavGroup({
  location,
  search = "",
  onNavigate,
  variant = "sidebar",
}: AuditListingNavGroupProps) {
  const isMobile = variant === "mobile";
  const active = isAuditListingSectionPath(location, search);

  return (
    <button
      type="button"
      onClick={() => onNavigate(AUDIT_LISTING_HOME_HREF)}
      className={cn(
        "w-full flex items-center gap-1.5 text-left min-w-0 rounded-lg transition-colors",
        isMobile ? "px-3 py-2.5 min-h-9 text-xs" : "px-2.5 py-2 text-[11px]",
        active
          ? "bg-orange-500 text-white font-medium shadow-sm"
          : isMobile
            ? "text-slate-600 hover:bg-slate-100 font-normal"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 font-normal",
      )}
    >
      <FileSearch
        className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          isMobile ? "w-4 h-4" : "",
          active ? "text-white" : isMobile ? "" : "text-sidebar-foreground/75",
        )}
      />
      <span className="truncate flex-1 min-w-0">Audit Listing</span>
    </button>
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
      onClick={() => onNavigate(AUDIT_LISTING_HOME_HREF)}
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