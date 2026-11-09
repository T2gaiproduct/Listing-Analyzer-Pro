import { useEffect, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { filterProductCategories } from "@/lib/product-categories";

type Props = {
  value: string;
  onChange: (name: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
};

export function AdminSearchableCategorySelect({
  value,
  onChange,
  options,
  placeholder = "Search categories…",
  className,
}: Props) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  const filtered = filterProductCategories(options, search);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative flex gap-2 mt-1.5", className)}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="pl-9 pr-9 h-9 text-sm"
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              aria-label={open ? "Close category list" : "Open category list"}
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
            </button>
          </div>
          {value ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-9 w-9"
              title="Clear category"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="p-0 max-h-72 overflow-y-auto overscroll-contain w-[var(--radix-popover-trigger-width)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No categories found</div>
        ) : (
          filtered.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={value === name}
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm hover:bg-orange-50",
                value === name && "bg-orange-50 text-orange-800 font-medium",
              )}
              onClick={() => {
                onChange(name);
                setSearch(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
