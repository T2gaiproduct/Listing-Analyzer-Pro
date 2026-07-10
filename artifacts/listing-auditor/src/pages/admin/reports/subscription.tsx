import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReportTable, type ReportColumn } from "@/components/report-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Subscription {
  id: number;
  userId: string;
  planName: string | null;
  billingCycle: string;
  status: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    trial: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    expired: "bg-slate-100 text-slate-600",
  };
  return <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

export default function SubscriptionReport() {
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-subscriptions"],
    queryFn: () => fetch(`${basePath}/api/admin/subscriptions`, { credentials: "include" }).then((r) => r.json()),
  });

  const subs: Subscription[] = data?.subscriptions ?? [];

  const rows = useMemo(() => subs.filter((s) => (status ? s.status === status : true)), [subs, status]);

  const amount = (s: Subscription) => s.billingCycle === "yearly" ? Number(s.priceYearly ?? 0) : Number(s.priceMonthly ?? 0);

  const columns: ReportColumn<Subscription>[] = [
    { key: "id", header: "Sub ID", value: (r) => `#${r.id}` },
    { key: "userId", header: "Customer", value: (r) => r.userId },
    { key: "planName", header: "Plan", value: (r) => r.planName ?? "—" },
    { key: "billingCycle", header: "Billing", value: (r) => r.billingCycle },
    { key: "amount", header: "Amount", align: "right", value: (r) => amount(r), render: (r) => `$${amount(r).toFixed(2)}` },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => statusBadge(r.status) },
    { key: "currentPeriodEnd", header: "Renews / Ends", value: (r) => (r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toISOString() : ""), render: (r) => (r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : "—") },
  ];

  return (
    <ReportTable
      title="Subscription Report"
      description={`${rows.length} subscriptions`}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      exportFilename="subscription-report"
      searchPlaceholder="Search subscriptions…"
      filters={
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      }
    />
  );
}
