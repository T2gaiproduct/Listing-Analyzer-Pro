import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ReportTable, type ReportColumn } from "@/components/report-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Payment {
  id: number;
  userId: string;
  amount: number;
  currency: string | null;
  status: string;
  gateway: string | null;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-slate-100 text-slate-600",
  };
  return <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

export default function RevenueReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-revenue"],
    queryFn: () => fetch(`${basePath}/api/admin/payments?limit=200`, { credentials: "include" }).then((r) => r.json()),
  });

  const payments: Payment[] = data?.payments ?? [];

  const rows = useMemo(() => payments.filter((p) => {
    if (status && p.status !== status) return false;
    const d = new Date(p.createdAt);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  }), [payments, from, to, status]);

  const total = rows.filter((p) => ["completed", "paid"].includes(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);

  const columns: ReportColumn<Payment>[] = [
    { key: "id", header: "Payment ID", value: (r) => `#${r.id}` },
    { key: "userId", header: "Customer", value: (r) => r.userId },
    { key: "amount", header: "Amount", align: "right", value: (r) => Number(r.amount || 0), render: (r) => `$${Number(r.amount || 0).toFixed(2)}` },
    { key: "gateway", header: "Gateway", value: (r) => r.gateway ?? "—" },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => statusBadge(r.status) },
    { key: "createdAt", header: "Date", value: (r) => new Date(r.createdAt).toISOString(), render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <ReportTable
      title="Revenue Report"
      description={`Total revenue (completed): $${total.toFixed(2)} · ${rows.length} transactions`}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      exportFilename="revenue-report"
      searchPlaceholder="Search payments…"
      filters={
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">From</label>
            <Input type="date" className="h-9 w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">To</label>
            <Input type="date" className="h-9 w-44" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      }
    />
  );
}
