import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type SalesMetric = "revenue" | "orders" | "units";

interface SalesKpi {
  value: number;
  changePercent: number;
  direction: "up" | "down";
}

interface ProductSalesResponse {
  currency: string;
  kpis: {
    totalRevenue: SalesKpi;
    totalOrders: SalesKpi;
    unitsSold: SalesKpi;
    avgOrderValue: SalesKpi;
  };
  trend: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
    units: number;
  }>;
  revenueSplit: Array<{
    marketplace: string;
    revenue: number;
    percent: number;
    color: string;
  }>;
  marketplaceRevenue: Array<{
    marketplace: string;
    revenue: number;
    color: string;
    changePercent: number;
    direction: "up" | "down";
    sharePercent: number;
  }>;
}

const MARKETPLACE_CARD_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  Amazon: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
  Flipkart: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
  Shopify: { bg: "bg-sky-50", text: "text-sky-600", bar: "bg-sky-500" },
  WooCommerce: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" },
};

const FALLBACK_MARKETPLACES: ProductSalesResponse["marketplaceRevenue"] = [
  { marketplace: "Amazon", revenue: 0, color: "#f59e0b", changePercent: 0, direction: "up", sharePercent: 0 },
  { marketplace: "Flipkart", revenue: 0, color: "#3b82f6", changePercent: 0, direction: "up", sharePercent: 0 },
  { marketplace: "Shopify", revenue: 0, color: "#0ea5e9", changePercent: 0, direction: "up", sharePercent: 0 },
  { marketplace: "WooCommerce", revenue: 0, color: "#22c55e", changePercent: 0, direction: "up", sharePercent: 0 },
];

const METRIC_OPTIONS: Array<{ id: SalesMetric; label: string }> = [
  { id: "revenue", label: "Revenue" },
  { id: "orders", label: "Orders" },
  { id: "units", label: "Units" },
];

function formatCurrency(value: number, currency: string): string {
  if (currency === "INR") return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCurrencyDetailed(value: number, currency: string): string {
  if (currency === "INR") return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function KpiCard({
  label,
  value,
  kpi,
}: {
  label: string;
  value: string;
  kpi: SalesKpi;
}) {
  const isUp = kpi.direction === "up";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      <div className={cn(
        "inline-flex items-center gap-1 mt-2 text-[10px] font-medium",
        isUp ? "text-emerald-600" : "text-red-500",
      )}
      >
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {kpi.changePercent}% vs last month
      </div>
    </div>
  );
}

function SalesTrendTooltip({
  active,
  payload,
  label,
  metric,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  metric: SalesMetric;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const formatted = metric === "revenue" ? formatCurrencyDetailed(value, currency) : value.toLocaleString();
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-sm">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900 mt-0.5">{formatted}</p>
    </div>
  );
}

export function ProductSalesTab({ productId, enabled }: { productId: number; enabled: boolean }) {
  const [metric, setMetric] = useState<SalesMetric>("revenue");

  const { data, isLoading } = useQuery({
    queryKey: ["product-sales", productId],
    queryFn: () => fetchJson<ProductSalesResponse>(`${basePath}/api/products/${productId}/sales`),
    enabled: enabled && productId > 0,
    staleTime: 15_000,
  });

  const currency = data?.currency ?? "USD";

  const chartData = useMemo(() => {
    return (data?.trend ?? []).map((point) => ({
      ...point,
      value: metric === "revenue" ? point.revenue : metric === "orders" ? point.orders : point.units,
    }));
  }, [data?.trend, metric]);

  const yAxisFormatter = (value: number) => {
    if (metric === "revenue") {
      if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
      return `$${value}`;
    }
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Skeleton className="h-80 rounded-xl xl:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const revenueSplit = data?.revenueSplit ?? FALLBACK_MARKETPLACES.map((item) => ({
    marketplace: item.marketplace,
    revenue: item.revenue,
    percent: item.sharePercent,
    color: item.color,
  }));
  const marketplaceRevenue = data?.marketplaceRevenue?.length
    ? data.marketplaceRevenue
    : FALLBACK_MARKETPLACES;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(kpis?.totalRevenue.value ?? 0, currency)}
          kpi={kpis?.totalRevenue ?? { value: 0, changePercent: 0, direction: "up" }}
        />
        <KpiCard
          label="Total Orders"
          value={(kpis?.totalOrders.value ?? 0).toLocaleString()}
          kpi={kpis?.totalOrders ?? { value: 0, changePercent: 0, direction: "up" }}
        />
        <KpiCard
          label="Units Sold"
          value={(kpis?.unitsSold.value ?? 0).toLocaleString()}
          kpi={kpis?.unitsSold ?? { value: 0, changePercent: 0, direction: "up" }}
        />
        <KpiCard
          label="Avg. Order Value"
          value={formatCurrencyDetailed(kpis?.avgOrderValue.value ?? 0, currency)}
          kpi={kpis?.avgOrderValue ?? { value: 0, changePercent: 0, direction: "down" }}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-900">Sales — Last 30 Days</h2>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {METRIC_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMetric(option.id)}
                  className={cn(
                    "h-7 px-3 rounded-md text-[10px] font-medium transition-colors",
                    metric === option.id
                      ? "bg-white text-orange-700 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-500">
                No sales data for the last 30 days.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={yAxisFormatter}
                    width={42}
                  />
                  <Tooltip content={<SalesTrendTooltip metric={metric} currency={currency} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#salesAreaFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-900 mb-4">Revenue Split</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueSplit}
                  dataKey="revenue"
                  nameKey="marketplace"
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="78%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {revenueSplit.map((entry) => (
                    <Cell key={entry.marketplace} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrencyDetailed(value, currency)}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {revenueSplit.map((item) => (
              <div key={item.marketplace} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 truncate">{item.marketplace}</span>
                </div>
                <span className="font-medium text-slate-900 tabular-nums">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900 mb-3">Revenue by Marketplace</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {marketplaceRevenue.map((item) => {
            const styles = MARKETPLACE_CARD_STYLES[item.marketplace] ?? {
              bg: "bg-slate-50",
              text: "text-slate-600",
              bar: "bg-slate-400",
            };
            const isUp = item.direction === "up";
            return (
              <div
                key={item.marketplace}
                className={cn("rounded-xl border border-slate-200/80 overflow-hidden", styles.bg)}
              >
                <div className="p-4 pb-3">
                  <p className={cn("text-[11px] font-semibold", styles.text)}>
                    {item.marketplace}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatCurrency(item.revenue, currency)}
                  </p>
                  <div className={cn(
                    "inline-flex items-center gap-0.5 mt-1.5 text-[10px] font-medium",
                    isUp ? styles.text : "text-red-500",
                  )}
                  >
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {item.changePercent}%
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", styles.bar)}
                      style={{ width: `${Math.max(item.sharePercent, item.revenue > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
