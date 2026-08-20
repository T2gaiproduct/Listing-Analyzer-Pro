import { useState, type RefObject } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  ExternalLink,
  Columns3,
  Download,
  List,
  ChevronRight,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { downloadAdsConsoleCsv, type AdsConsoleCsvExport } from "@/lib/ads-console-csv";

export type AdsConsoleColumnOption = {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
};

type ToolbarProps = {
  title: string;
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  selectedCount: number;
  onBulkEnable?: () => void;
  onBulkPause?: () => void;
  onBulkArchive?: () => void;
  onBulkBudget?: (budget: number) => void;
  bulkPending?: boolean;
  showBulk?: boolean;
  createHref?: string;
  createLabel?: string;
  showCreate?: boolean;
  onFiltersClick?: () => void;
  hideActivityLog?: boolean;
  showBudgetBulk?: boolean;
  onAiClick?: () => void;
  exportData?: AdsConsoleCsvExport | null;
  onExportEmpty?: () => void;
  columnOptions?: AdsConsoleColumnOption[];
  onColumnVisibilityChange?: (id: string, visible: boolean) => void;
  compactView?: boolean;
  onCompactViewChange?: (compact: boolean) => void;
  tableRef?: RefObject<HTMLElement | null>;
};

export function AdsConsoleToolbar({
  title,
  compare,
  onCompareChange,
  selectedCount,
  onBulkEnable,
  onBulkPause,
  onBulkArchive,
  onBulkBudget,
  bulkPending,
  showBulk = true,
  createHref = "/ads/new",
  createLabel = "Create",
  showCreate = true,
  onFiltersClick,
  hideActivityLog = false,
  showBudgetBulk = true,
  onAiClick,
  exportData,
  onExportEmpty,
  columnOptions,
  onColumnVisibilityChange,
  compactView = false,
  onCompactViewChange,
  tableRef,
}: ToolbarProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetValue, setBudgetValue] = useState("10");

  function handleDownload() {
    if (!exportData?.rows.length) {
      onExportEmpty?.();
      return;
    }
    downloadAdsConsoleCsv(exportData);
  }

  function handleListClick() {
    if (onCompactViewChange) {
      onCompactViewChange(!compactView);
      return;
    }
    tableRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasOptionalColumns = columnOptions?.some((col) => !col.required);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title ? <h1 className="text-lg font-semibold text-slate-800">{title}</h1> : <div />}
        <div className="flex flex-wrap items-center gap-2">
          {onFiltersClick && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-slate-600 bg-white"
              onClick={onFiltersClick}
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          )}
          {onAiClick ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-orange-600 border-orange-200 bg-white hover:bg-orange-50"
              onClick={onAiClick}
            >
              <Sparkles className="w-4 h-4" />
              AI
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-orange-600 border-orange-200 bg-white hover:bg-orange-50"
              asChild
            >
              <Link href="/ads/new">
                <Sparkles className="w-4 h-4" />
                AI
              </Link>
            </Button>
          )}
          {!hideActivityLog && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500" asChild>
              <a href="https://advertising.amazon.com/cm/campaigns" target="_blank" rel="noopener noreferrer">
                Activity Log
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 text-slate-500",
              compactView && "bg-orange-50 text-orange-600",
            )}
            aria-label={onCompactViewChange ? "Toggle compact rows" : "Scroll to table"}
            title={onCompactViewChange ? (compactView ? "Comfortable rows" : "Compact rows") : "Scroll to table"}
            onClick={handleListClick}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-500"
            aria-label="Download CSV"
            title="Download CSV"
            onClick={handleDownload}
            disabled={!exportData?.rows.length}
          >
            <Download className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 pl-1">
            <Switch id="ads-compare" checked={compare} onCheckedChange={onCompareChange} />
            <Label htmlFor="ads-compare" className="text-sm text-slate-600 font-normal">Compare</Label>
          </div>
          {hasOptionalColumns && columnOptions && onColumnVisibilityChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-slate-600 bg-white">
                  <Columns3 className="w-4 h-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnOptions.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    className="gap-2"
                    disabled={col.required}
                    onSelect={(e) => {
                      e.preventDefault();
                      if (!col.required) {
                        onColumnVisibilityChange(col.id, !col.visible);
                      }
                    }}
                  >
                    <Checkbox
                      checked={col.visible}
                      disabled={col.required}
                      onCheckedChange={(checked) => {
                        if (!col.required) {
                          onColumnVisibilityChange(col.id, checked === true);
                        }
                      }}
                    />
                    <span>{col.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {showCreate && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-orange-500 text-orange-600 hover:bg-orange-50"
              asChild
            >
              <Link href={createHref}>{createLabel}</Link>
            </Button>
          )}
          {showBulk && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  disabled={bulkPending}
                >
                  Bulk Action
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {selectedCount === 0 ? (
                  <DropdownMenuItem disabled>Select rows to run bulk actions</DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={onBulkEnable}>Enable</DropdownMenuItem>
                    <DropdownMenuItem onClick={onBulkPause}>Pause</DropdownMenuItem>
                    <DropdownMenuItem onClick={onBulkArchive}>Archive</DropdownMenuItem>
                    {showBudgetBulk && (
                      <DropdownMenuItem onClick={() => setBudgetOpen(true)}>Set daily budget</DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set daily budget</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs text-slate-500">Daily budget ({selectedCount} campaigns)</Label>
            <Input
              type="number"
              min={1}
              step={0.01}
              className="mt-1"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                const n = parseFloat(budgetValue);
                if (n > 0) {
                  onBulkBudget?.(n);
                  setBudgetOpen(false);
                }
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdsConsoleTableShell({
  loading,
  empty,
  emptyMessage,
  compact,
  shellRef,
  children,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  shellRef?: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={shellRef}
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden",
        compact && "[&_td]:py-1.5 [&_th]:py-2 [&_td]:text-xs [&_th]:text-xs",
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading from Amazon Ads…
        </div>
      ) : empty ? (
        <div className="py-16 text-center text-sm text-slate-500">{emptyMessage ?? "No data yet."}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

export function adsStateBadge(state: string) {
  const normalized = state.toUpperCase();
  return cn(
    "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
    normalized === "ENABLED" && "bg-emerald-50 text-emerald-700",
    normalized === "PAUSED" && "bg-amber-50 text-amber-700",
    normalized === "ARCHIVED" && "bg-slate-100 text-slate-600",
    !["ENABLED", "PAUSED", "ARCHIVED"].includes(normalized) && "bg-slate-100 text-slate-600",
  );
}
