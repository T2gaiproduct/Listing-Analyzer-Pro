import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}

/** Horizontal scroll wrapper for data tables on narrow viewports. */
export function ResponsiveTable({ children, className, minWidth = "36rem" }: ResponsiveTableProps) {
  return (
    <div className={cn("table-responsive scrollbar-hide", className)}>
      <div style={{ minWidth }} className="w-full">
        {children}
      </div>
    </div>
  );
}
