import type { LucideIcon } from "lucide-react";
import { Link2, PackageSearch, PencilLine } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type BuildBrandStartEntry = "existing" | "import-link" | "scratch";

type Option = {
  entry: BuildBrandStartEntry;
  title: string;
  description: string;
  icon: LucideIcon;
  iconWrap: string;
  iconColor: string;
};

const options: Option[] = [
  {
    entry: "existing",
    title: "Existing product",
    description: "Continue from a product already in your catalog or recent projects.",
    icon: PackageSearch,
    iconWrap: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    entry: "import-link",
    title: "Import from links",
    description: "Paste a marketplace product URL or ASIN to pull listing details.",
    icon: Link2,
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    entry: "scratch",
    title: "Create from scratch",
    description: "Upload product images and details — AI builds the full listing flow.",
    icon: PencilLine,
    iconWrap: "bg-orange-50 ring-1 ring-orange-200",
    iconColor: "text-orange-500",
  },
];

export function BuildBrandStartDrawer({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (entry: BuildBrandStartEntry) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-orange-100 sm:max-w-md"
      >
        <SheetHeader className="text-left space-y-1 pr-8">
          <SheetTitle className="text-xl font-bold text-foreground">Start generating</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Choose how you&apos;d like to begin your Build Your Brand project
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.entry}
                type="button"
                onClick={() => onChoose(opt.entry)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left",
                  "transition-colors hover:border-orange-300 hover:bg-orange-50/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    opt.iconWrap,
                  )}
                >
                  <Icon className={cn("h-5 w-5", opt.iconColor)} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
