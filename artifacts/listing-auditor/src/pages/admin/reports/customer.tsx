import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReportTable, type ReportColumn } from "@/components/report-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  auditCount: number;
  banned: boolean;
  locked: boolean;
  createdAt: number | string | null;
}

export default function CustomerReport() {
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-customers"],
    queryFn: () => fetch(`${basePath}/api/admin/customers?limit=200`, { credentials: "include" }).then((r) => r.json()),
  });

  const customers: Customer[] = data?.customers ?? [];

  const rows = useMemo(() => customers.filter((c) => {
    if (status === "active") return !c.banned && !c.locked;
    if (status === "banned") return c.banned;
    if (status === "locked") return c.locked;
    return true;
  }), [customers, status]);

  const fmtDate = (v: number | string | null) => v ? new Date(typeof v === "number" ? v : v).toLocaleDateString() : "—";
  const fullName = (c: Customer) => `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";

  const columns: ReportColumn<Customer>[] = [
    { key: "name", header: "Name", value: (r) => fullName(r) },
    { key: "email", header: "Email", value: (r) => r.email },
    { key: "auditCount", header: "Audits", align: "right", value: (r) => r.auditCount ?? 0 },
    { key: "createdAt", header: "Joined", value: (r) => (r.createdAt ? new Date(typeof r.createdAt === "number" ? r.createdAt : r.createdAt).toISOString() : ""), render: (r) => fmtDate(r.createdAt) },
    {
      key: "status", header: "Status",
      value: (r) => (r.banned ? "Banned" : r.locked ? "Locked" : "Active"),
      render: (r) => {
        const s = r.banned ? "Banned" : r.locked ? "Locked" : "Active";
        const cls = r.banned ? "bg-red-100 text-red-700" : r.locked ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
        return <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{s}</span>;
      },
    },
  ];

  return (
    <ReportTable
      title="Customer Report"
      description={`${rows.length} customers`}
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      exportFilename="customer-report"
      searchPlaceholder="Search name or email…"
      filters={
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>
      }
    />
  );
}
