import { useEffect, useMemo, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const closedDisplay = value ? leafLabel : "";
  const inputValue = open ? search : closedDisplay;
  const inputPlaceholder = !open && !value ? placeholder : searchPlaceholder;

  function startSearch() {
    if (!open) {
      setOpen(true);
      setSearch("");
      window.requestAnimationFrame(() => inputRef.current?.select());
    }
  }

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
          <div
            className={cn(
              "relative w-full rounded-xl border border-border bg-card shadow-none",
              open && "ring-2 ring-orange-200 border-orange-400",
              triggerClassName,
            )}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-[1]" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              readOnly={!open && Boolean(value)}
              placeholder={inputPlaceholder}
              className={cn(
                "w-full h-11 sm:h-12 pl-9 pr-9 rounded-xl text-sm bg-transparent",
                "focus:outline-none text-foreground placeholder:text-muted-foreground",
                !open && value && "cursor-pointer",
              )}
              autoComplete="off"
              title={displayPath || undefined}
              onFocus={startSearch}
              onClick={() => {
                if (!open) startSearch();
              }}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!open) setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  inputRef.current?.blur();
                }
              }}
            />
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center text-muted-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (open ? setOpen(false) : startSearch())}
            >
              <ChevronDown className={cn("w-4 h-4", open && "rotate-180 transition-transform")} />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions={false}
          className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[min(380px,55vh)] overflow-hidden flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
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
                    onMouseDown={(e) => e.preventDefault()}
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
