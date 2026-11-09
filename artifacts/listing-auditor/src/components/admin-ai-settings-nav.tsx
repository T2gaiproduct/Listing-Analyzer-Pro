import { ChevronDown, BrainCircuit } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  ADMIN_AI_NAV_ITEMS,
  ADMIN_AI_SETTINGS_HREF,
  isAdminAiProviderPage,
  isAdminAiSettingsPath,
} from "@/lib/admin-ai-settings-nav";

type AdminAiSettingsNavGroupProps = {
  location: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
};

export function AdminAiSettingsNavGroup({
  location,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
}: AdminAiSettingsNavGroupProps) {
  const isGroupActive = isAdminAiSettingsPath(location);
  const isOnProviderPage = isAdminAiProviderPage(location);

  if (collapsed) {
    return (
      <Link
        href={ADMIN_AI_SETTINGS_HREF}
        title="AI Settings"
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-center rounded-md min-h-9 px-2 py-1.5 transition-all",
          isGroupActive
            ? "bg-orange-500 text-white shadow-sm"
            : "text-white/90 hover:bg-slate-800 hover:text-white",
        )}
      >
        <BrainCircuit className="w-3.5 h-3.5 flex-shrink-0" />
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-md transition-colors",
          isOnProviderPage
            ? "bg-orange-500 text-white shadow-sm"
            : isGroupActive
              ? "bg-slate-800/80"
              : "hover:bg-slate-800",
        )}
      >
        <Link
          href={ADMIN_AI_SETTINGS_HREF}
          onClick={onNavigate}
          className={cn(
            "flex flex-1 items-center gap-2.5 px-3 py-1.5 text-xs font-medium min-h-9 min-w-0 text-left",
            isOnProviderPage ? "text-white" : "text-white/90",
          )}
        >
          <BrainCircuit
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              isOnProviderPage ? "text-white" : "text-white/70",
            )}
          />
          <span className="truncate">AI Settings</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse AI Settings menu" : "Expand AI Settings menu"}
          className={cn(
            "shrink-0 p-1.5 mr-1 rounded-md",
            isOnProviderPage ? "text-white/90 hover:bg-white/10" : "text-white/70 hover:text-white",
          )}
        >
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-0.5 pl-3 ml-2 border-l border-slate-700/80">
          {ADMIN_AI_NAV_ITEMS.map((child) => {
            const childActive = location === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium min-h-8 transition-all",
                  childActive
                    ? "bg-orange-500/90 text-white"
                    : "text-white/75 hover:bg-slate-800 hover:text-white",
                )}
              >
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
