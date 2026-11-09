import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = filterProductCategories(options, search);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="mt-1.5 pl-9 h-9 text-sm"
          autoComplete="off"
        />
      </div>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto overscroll-contain"
          role="listbox"
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
        </div>
      )}
    </div>
  );
}
