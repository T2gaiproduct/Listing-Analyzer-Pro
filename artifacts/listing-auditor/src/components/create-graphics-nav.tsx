import { ChevronDown, ImageIcon, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRAPHICS_IN_DETAIL_HREF,
  isCreateGraphicsSectionPath,
  isGraphicsInDetailNavActive,
} from "@/lib/graphics-in-detail-nav";

export const CREATE_GRAPHICS_HOME_HREF = "/projects";

type CreateGraphicsNavGroupProps = {
  location: string;
  search?: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
  variant?: "sidebar" | "mobile";
};

export function CreateGraphicsNavGroup({
  location,
  search = "",
  expanded,
  onToggle,
  onNavigate,
  variant = "sidebar",
}: CreateGraphicsNavGroupProps) {
  const isMobile = variant === "mobile";
  const childActive = isGraphicsInDetailNavActive(location, search);
  const sectionActive = isCreateGraphicsSectionPath(location, search);
  const parentActive = sectionActive && !childActive;

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors",
          parentActive
            ? "bg-orange-500 text-white shadow-sm"
            : isMobile
              ? "hover:bg-slate-100"
              : "hover:bg-sidebar-accent/50",
        )}
      >
        <button
          type="button"
          onClick={() => {
            onNavigate(CREATE_GRAPHICS_HOME_HREF);
            if (!expanded) onToggle();
          }}
          className={cn(
            "flex flex-1 items-center gap-1.5 text-left min-w-0",
            isMobile ? "px-3 py-2.5 min-h-9 text-xs" : "px-2.5 py-2 text-[11px]",
            parentActive
              ? "font-medium text-white"
              : isMobile
                ? "text-slate-600 font-normal"
                : "text-sidebar-foreground font-normal",
          )}
        >
          <Palette
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              isMobile ? "w-4 h-4" : "",
              parentActive ? "text-white" : isMobile ? "" : "text-sidebar-foreground/75",
            )}
          />
          <span className="truncate flex-1 min-w-0">Create Graphics</span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse Create Graphics menu" : "Expand Create Graphics menu"}
          className={cn(
            "shrink-0 p-1.5 rounded-md",
            parentActive ? "text-white/90 hover:bg-white/10" : "opacity-70 hover:opacity-100",
          )}
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className={cn("space-y-0.5", isMobile ? "pl-2" : "pl-1 ml-1 border-l border-sidebar-border/60")}>
          <button
            type="button"
            onClick={() => onNavigate(GRAPHICS_IN_DETAIL_HREF)}
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
            <ImageIcon
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                childActive ? "text-white" : isMobile ? "text-slate-400" : "text-sidebar-foreground/50",
              )}
            />
            <span className="truncate flex-1">Graphics in Detail</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function CreateGraphicsNavCollapsed({
  location,
  search = "",
  onNavigate,
}: {
  location: string;
  search?: string;
  onNavigate: (href: string) => void;
}) {
  const isSectionActive = isCreateGraphicsSectionPath(location, search);

  return (
    <button
      type="button"
      onClick={() => onNavigate(
        isGraphicsInDetailNavActive(location, search)
          ? GRAPHICS_IN_DETAIL_HREF
          : CREATE_GRAPHICS_HOME_HREF,
      )}
      className={cn(
        "w-full flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
        isSectionActive
          ? "bg-orange-500 text-white shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
      aria-label="Create Graphics"
    >
      <Palette className="w-4 h-4" />
    </button>
  );
}
