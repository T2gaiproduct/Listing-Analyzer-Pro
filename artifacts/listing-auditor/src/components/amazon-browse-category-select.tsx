import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  filterAmazonBrowseCategories,
  findBrowseCategoryByPath,
  leafLabelFromBrowsePath,
  browsePathSegments,
  PFA_BROWSE_CATEGORIES,
  rememberBrowseCategorySelection,
  resolveRecentBrowseCategories,
  type AmazonBrowseCategory,
} from "@/lib/amazon-browse-categories";

type Props = {
  value: string;
  onChange: (browsePath: string) => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
};

export function AmazonBrowseCategorySelect({
  value,
  onChange,
  required,
  label = "Category",
  placeholder = "Select a category",
  searchPlaceholder = "Search a category or product — e.g. lipstick, boots",
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const selected = useMemo(() => findBrowseCategoryByPath(value), [value]);
  const displayPath = selected?.browsePath ?? value;
  const leafLabel = selected?.label ?? (value ? leafLabelFromBrowsePath(value) : "");

  const recent = useMemo(() => resolveRecentBrowseCategories(PFA_BROWSE_CATEGORIES), [open]);
  const searchResults = useMemo(
    () => filterAmazonBrowseCategories(PFA_BROWSE_CATEGORIES, search),
    [search],
  );

  const showRecent = !search.trim() && recent.length > 0;
  const listItems: AmazonBrowseCategory[] = showRecent ? recent : searchResults;

  function pick(category: AmazonBrowseCategory) {
    rememberBrowseCategorySelection(category.browsePath);
    onChange(category.browsePath);
    setOpen(false);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "relative w-full h-11 sm:h-12 pl-3 pr-9 rounded-xl border border-border text-sm bg-card shadow-none",
              "focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 text-left flex items-center",
              triggerClassName,
            )}
            title={displayPath || undefined}
          >
            {value ? (
              <span className="block min-w-0 pr-1 text-foreground truncate">{leafLabel}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </button>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[min(420px,70vh)] overflow-hidden flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="sticky top-0 bg-popover border-b border-border px-3 py-2.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
          <div className="overflow-y-auto overscroll-contain flex-1">
            {showRecent ? (
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recently used
              </p>
            ) : null}
            {listItems.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">No categories found</div>
            ) : (
              listItems.map((c) => {
                const isSelected = value === c.browsePath;
                return (
                  <button
                    key={c.browseNodeId}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-orange-50",
                      isSelected && "bg-orange-50",
                    )}
                    onClick={() => pick(c)}
                  >
                    <span
                      className={cn(
                        "block text-sm text-foreground",
                        isSelected && "font-semibold text-orange-800",
                      )}
                    >
                      {c.label}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug whitespace-normal break-words">
                      {browsePathSegments(c.browsePath).join(" > ")}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
