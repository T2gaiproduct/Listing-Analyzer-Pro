import { cn } from "@/lib/utils";

/** Shared inner panel styles for Settings cards — theme-aware for light/dark mode. */
export function settingsPanelClassName(className?: string) {
  return cn(
    "rounded-xl border border-border bg-muted/40 px-4 py-3",
    className,
  );
}
