import { useQuery } from "@tanstack/react-query";
import { CreditCard, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CreditRow {
  id: number;
  userId: string;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  updatedAt: string;
}

function fetchCredits(): Promise<CreditRow[]> {
  return fetch(`${basePath}/api/admin/credits`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminCredits() {
  const { data: credits = [], isLoading } = useQuery({ queryKey: ["admin-credits"], queryFn: fetchCredits });

  const totals = credits.reduce(
    (acc, c) => ({ ai: acc.ai + c.aiCredits, image: acc.image + c.imageCredits, audit: acc.audit + c.auditCredits }),
    { ai: 0, image: 0, audit: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Credits Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Platform-wide credit balances. Adjust credits on individual customer pages.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total AI Credits", value: totals.ai, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Total Image Credits", value: totals.image, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Audit Credits", value: totals.audit, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                <CreditCard className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                {isLoading ? (
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900">{kpi.value.toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">User Credit Balances</CardTitle>
        </CardHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User ID</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">AI</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Image</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Audit</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
            {!isLoading && credits.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-3 font-mono text-xs text-slate-500 truncate max-w-[200px]">{c.userId}</td>
                <td className="px-4 py-3 text-right font-semibold text-purple-700">{c.aiCredits}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{c.imageCredits}</td>
                <td className="px-4 py-3 text-right font-semibold text-orange-700">{c.auditCredits}</td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
            {!isLoading && credits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No credit records yet. Assign credits via customer detail pages.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
