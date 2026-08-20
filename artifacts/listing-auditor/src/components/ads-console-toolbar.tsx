import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  showColumnsLabel?: boolean;
  showAdvancedFilters?: boolean;
  hideActivityLog?: boolean;
  onAiClick?: () => void;
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
  showColumnsLabel = false,
  showAdvancedFilters = true,
  hideActivityLog = false,
  onAiClick,
}: ToolbarProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetValue, setBudgetValue] = useState("10");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title ? <h1 className="text-lg font-semibold text-slate-800">{title}</h1> : <div />}
        <div className="flex flex-wrap items-center gap-2">
          {showAdvancedFilters && (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-slate-600 bg-white">
              <Filter className="w-4 h-4" />
              Advanced Filters
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-orange-600 border-orange-200 bg-white hover:bg-orange-50"
            onClick={onAiClick}
          >
            <Sparkles className="w-4 h-4" />
            AI
          </Button>
          {!hideActivityLog && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500" asChild>
              <a href="https://advertising.amazon.com/cm/campaigns" target="_blank" rel="noopener noreferrer">
                Activity Log
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
            <Download className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 pl-1">
            <Switch id="ads-compare" checked={compare} onCheckedChange={onCompareChange} />
            <Label htmlFor="ads-compare" className="text-sm text-slate-600 font-normal">Compare</Label>
          </div>
          {showColumnsLabel ? (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-slate-600 bg-white">
              <Columns3 className="w-4 h-4" />
              Columns
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
              <Columns3 className="w-4 h-4" />
            </Button>
          )}
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
                  disabled={selectedCount === 0 || bulkPending}
                >
                  Bulk Action
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onBulkEnable}>Enable</DropdownMenuItem>
                <DropdownMenuItem onClick={onBulkPause}>Pause</DropdownMenuItem>
                <DropdownMenuItem onClick={onBulkArchive}>Archive</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBudgetOpen(true)}>Set daily budget</DropdownMenuItem>
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
  children,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
