import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Trash2, Eye, FileText, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 50;

interface Audit {
  id: number;
  userId: string;
  productName: string;
  asin: string | null;
  category: string | null;
  overallScore: number;
  status: string;
  createdAt: string;
}

function fetchAudits(offset: number): Promise<{ audits: Audit[]; total: number }> {
  return fetch(`${basePath}/api/admin/audits?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminContentLogs() {
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", page],
    queryFn: () => fetchAudits(page * PAGE_SIZE),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/admin/audits/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-audit-logs"] }); toast({ title: "Audit deleted" }); },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => nav("/admin/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Admin Dashboard
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-slate-500 text-sm mt-1">{data ? `${data.total} total audits across all customers` : "Loading..."}</p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-8">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">ASIN</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
            {!isLoading && data?.audits.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-3 text-slate-400 text-xs">{a.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{a.productName}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.asin ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{a.category ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${a.overallScore >= 70 ? "bg-green-100 text-green-700" : a.overallScore >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {a.overallScore}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize px-1.5 py-0.5 rounded ${a.status === "complete" ? "bg-green-100 text-green-700" : a.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-orange-600"
                      title="View audit detail"
                      onClick={() => nav(`/audits/${a.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-red-600"
                      onClick={() => confirm(`Delete audit #${a.id}?`) && deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.audits.length && (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No audits found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Page {page + 1} of {totalPages} · {data?.total} total
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
