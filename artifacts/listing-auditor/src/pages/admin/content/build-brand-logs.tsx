import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { Eye, FilePlus2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GeneratedContent {
  title?: string;
  bulletPoints?: string[];
  keywords?: string[];
}

interface ContentItem {
  id: number;
  userId: string;
  productName: string;
  generatedContent: GeneratedContent | null;
  createdAt: string;
}

function fetchContent(): Promise<{ content: ContentItem[] }> {
  return fetch(`${basePath}/api/admin/content?limit=200`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminBuildBrandLogs() {
  const [, nav] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-build-brand-logs"],
    queryFn: fetchContent,
  });

  const items = (data?.content ?? []).filter((c) => c.generatedContent && c.generatedContent.title);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => nav("/admin/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Admin Dashboard
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Build Your Brand Logs</h1>
        <p className="text-slate-500 text-sm mt-1">
          {data ? `${items.length} brand content generations across all customers` : "Loading..."}
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-8">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Generated Title</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-3 text-slate-400 text-xs">{c.id}</td>
                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                  <Link href={`${basePath}/audits/${c.id}`} className="hover:text-orange-600 transition-colors">{c.productName}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[320px] truncate" title={c.generatedContent?.title ?? ""}>
                  {c.generatedContent?.title ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[160px] truncate" title={c.userId}>{c.userId}</td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </td>
                <td className="px-6 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-slate-400 hover:text-orange-600"
                    title="View audit detail"
                    onClick={() => nav(`/audits/${c.id}?returnTo=/admin/content/build-brand-logs`)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && !items.length && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <FilePlus2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No brand content generated yet</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
