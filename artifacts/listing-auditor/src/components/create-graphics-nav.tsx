import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isCreateGraphicsSectionPath,
} from "@/lib/graphics-in-detail-nav";

export const CREATE_GRAPHICS_HOME_HREF = "/projects";

type CreateGraphicsNavGroupProps = {
  location: string;
  search?: string;
  onNavigate: (href: string) => void;
  variant?: "sidebar" | "mobile";
};

export function CreateGraphicsNavGroup({
  location,
  search = "",
  onNavigate,
  variant = "sidebar",
}: CreateGraphicsNavGroupProps) {
  const isMobile = variant === "mobile";
  const active = isCreateGraphicsSectionPath(location, search);

  return (
    <button
      type="button"
      onClick={() => onNavigate(CREATE_GRAPHICS_HOME_HREF)}
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
      <Palette
        className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          isMobile ? "w-4 h-4" : "",
          active ? "text-white" : isMobile ? "" : "text-sidebar-foreground/75",
        )}
      />
      <span className="truncate flex-1 min-w-0">Create Graphics</span>
    </button>
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
      onClick={() => onNavigate(CREATE_GRAPHICS_HOME_HREF)}
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