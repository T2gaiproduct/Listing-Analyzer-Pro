import { ChevronDown, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact Windows-style explorer shell for Recent Projects folder tiles. */
export function RecentProjectsExplorer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-[#fafafa]",
        "shadow-sm overflow-hidden w-full min-w-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2",
          "border-b border-slate-200/80 bg-white/90",
        )}
      >
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          aria-label="Back"
          tabIndex={-1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
          aria-label="Forward"
          tabIndex={-1}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <div
          className={cn(
            "flex items-center gap-1.5 flex-1 min-w-0 h-7 px-2.5",
            "rounded border border-slate-200 bg-white text-xs text-slate-600",
          )}
        >
          <Home className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="truncate">Home</span>
          <span className="text-slate-400 shrink-0">›</span>
          <span className="truncate font-medium text-slate-800">Recent Projects</span>
        </div>
      </div>
      <div className="p-2.5 sm:p-3">{children}</div>
    </div>
  );
}

export function ExplorerFolderSection({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const label = count != null ? `${title} (${count})` : title;

  return (
    <section className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
        <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden />
        <h2 className="text-[13px] font-semibold text-slate-900 leading-4">{label}</h2>
      </div>
      {children}
    </section>
  );
}
