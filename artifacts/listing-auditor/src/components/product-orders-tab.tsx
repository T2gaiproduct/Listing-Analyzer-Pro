import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, CircleDot, Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type OrderStatus = "delivered" | "shipped" | "processing" | "returned";

interface ProductOrder {
  id: number;
  orderId: string;
  marketplace: string;
  customer: string;
  quantity: number;
  amount: number;
  currency: string;
  status: OrderStatus;
  statusLabel: string;
  date: string;
  tracking: string | null;
}

interface ProductOrdersResponse {
  orders: ProductOrder[];
  total: number;
  revenue: number;
}

const MARKETPLACE_OPTIONS = ["all", "Amazon", "Flipkart", "Shopify", "WooCommerce"] as const;
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "shipped", label: "Shipped" },
  { value: "processing", label: "Processing" },
  { value: "returned", label: "Returned" },
] as const;

const DATE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

function formatAmount(amount: number, currency: string): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        status === "delivered" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        status === "shipped" && "bg-blue-50 text-blue-700 border-blue-200",
        status === "processing" && "bg-amber-50 text-amber-700 border-amber-200",
        status === "returned" && "bg-red-50 text-red-700 border-red-200",
      )}
    >
      {label}
    </span>
  );
}

function FilterButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Store;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-medium transition-colors",
        active
          ? "bg-orange-50 text-orange-800 border-orange-200"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function ProductOrdersTab({
  productId,
  enabled,
  source,
}: {
  productId: number;
  enabled: boolean;
  source?: string;
}) {
  const [search, setSearch] = useState("");
  const [marketplace, setMarketplace] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (search.trim()) params.set("search", search.trim());
    if (marketplace !== "all") params.set("marketplace", marketplace);
    if (status !== "all") params.set("status", status);
    if (dateRange !== "all") params.set("dateRange", dateRange);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [source, search, marketplace, status, dateRange]);

  const { data, isLoading } = useQuery({
    queryKey: ["product-orders", productId, source, search, marketplace, status, dateRange],
    queryFn: () => fetchJson<ProductOrdersResponse>(`${basePath}/api/products/${productId}/orders${queryString}`),
    enabled: enabled && productId > 0,
    staleTime: 15_000,
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;

  const marketplaceLabel = marketplace === "all" ? "Marketplace" : marketplace;
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Status";
  const dateLabel = DATE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "Date";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="h-8 pl-8 text-xs border-slate-200 bg-white rounded-lg"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <FilterButton icon={Store} label={marketplaceLabel} active={marketplace !== "all"} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {MARKETPLACE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  className="text-xs"
                  onClick={() => setMarketplace(option)}
                >
                  {option === "all" ? "All marketplaces" : option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <FilterButton icon={CircleDot} label={statusLabel} active={status !== "all"} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="text-xs"
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <FilterButton icon={Calendar} label={dateLabel} active={dateRange !== "all"} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {DATE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="text-xs"
                  onClick={() => setDateRange(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-[11px] text-slate-400 whitespace-nowrap sm:ml-1">
            Showing {total} order{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {["Order ID", "Marketplace", "Customer", "Qty", "Amount", "Status", "Date", "Tracking"].map((header) => (
                <th
                  key={header}
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[88px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[11px] text-slate-500">
                  No orders match your filters yet.
                  {marketplace === "all" || marketplace === "Shopify" ? (
                    <span className="block mt-1 text-[10px] text-slate-400">
                      Shopify orders sync when you import products or open this tab.
                    </span>
                  ) : null}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-[11px] font-medium text-blue-600 tabular-nums">
                    {order.orderId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-50 text-slate-600 border-slate-200">
                      {order.marketplace}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-800">{order.customer}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-800 tabular-nums">{order.quantity}</td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-900 tabular-nums">
                    {formatAmount(order.amount, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} label={order.statusLabel} />
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-600 tabular-nums">
                    {format(new Date(order.date), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-600 font-mono">
                    {order.tracking ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
