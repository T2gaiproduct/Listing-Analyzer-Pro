import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Trash2, Eye, FileText, ChevronLeft, ChevronRight, Image, Palette, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 50;

interface GraphicsProject {
  id: number;
  userId: string;
  auditId: number | null;
  name: string;
  productName: string;
  category: string | null;
  designStyle: string;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  generatedCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function fetchProjects(offset: number): Promise<{ projects: GraphicsProject[]; total: number }> {
  return fetch(`${basePath}/api/admin/graphics-logs?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminGraphicsLogs() {
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-graphics-logs", page],
    queryFn: () => fetchProjects(page * PAGE_SIZE),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/admin/graphics-logs/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-graphics-logs"] }); toast({ title: "Project deleted" }); },
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
        <h1 className="text-2xl font-bold text-slate-900">Graphics Creation Logs</h1>
        <p className="text-slate-500 text-sm mt-1">{data ? `${data.total} total graphics projects across all customers` : "Loading..."}</p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-8">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Project</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Style</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Images</th>
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
            {!isLoading && data?.projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-3 text-slate-400 text-xs">{p.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                  <Link href={`${basePath}/projects/${p.id}`} className="hover:text-orange-600 transition-colors">{p.name}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                  <Link href={`${basePath}/audits/${p.auditId ?? p.id}`} className="hover:text-orange-600 transition-colors">{p.productName}</Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium capitalize px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {p.designStyle}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize px-1.5 py-0.5 rounded ${
                    p.status === "completed" ? "bg-green-100 text-green-700" :
                    p.status === "failed" ? "bg-red-100 text-red-700" :
                    p.status === "generating" ? "bg-purple-100 text-purple-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {p.status}
                  </span>
                  {p.status === "failed" && p.errorMessage && (
                    <p className="text-[10px] text-red-500 mt-0.5 max-w-[180px] truncate" title={p.errorMessage}>{p.errorMessage}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Image className="w-3 h-3" />
                    <span>{p.generatedCount} / {p.lifestyleCount + p.featureCount}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-orange-600"
                      title="View project"
                      onClick={() => nav(`/projects/${p.id}?returnTo=/admin/content/graphics-logs`)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-red-600"
                      onClick={() => confirm(`Delete project #${p.id}?`) && deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.projects.length && (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <Palette className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No graphics projects found</p>
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
