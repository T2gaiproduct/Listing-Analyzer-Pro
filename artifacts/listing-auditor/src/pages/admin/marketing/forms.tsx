import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Mail, CheckCircle, Trash2, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FormSubmission {
  id: number;
  formType: string;
  email: string | null;
  name: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export default function AdminMarketingForms() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const initialType = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("type") ?? "all"
    : "all";
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [selected, setSelected] = useState<FormSubmission | null>(null);

  const { data: submissions = [], isLoading } = useQuery<FormSubmission[]>({
    queryKey: ["admin-forms", typeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      return fetch(`${basePath}/api/admin/forms?${params}`, { credentials: "include" }).then((r) => r.json());
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/admin/forms/${id}/read`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-forms"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/forms/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-forms"] }); setSelected(null); toast({ title: "Submission deleted" }); },
  });

  function exportCsv() {
    if (!submissions.length) return;
    const rows = [["ID", "Type", "Name", "Email", "Date", "Data"]];
    for (const s of submissions) {
      rows.push([String(s.id), s.formType, s.name ?? "", s.email ?? "", format(new Date(s.createdAt), "yyyy-MM-dd"), JSON.stringify(s.data ?? {})]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "form-submissions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      contact: "bg-blue-100 text-blue-700",
      demo: "bg-purple-100 text-purple-700",
      newsletter: "bg-green-100 text-green-700",
      enterprise: "bg-orange-100 text-orange-700",
      support: "bg-amber-100 text-amber-700",
    };
    return <Badge className={`${colors[type] ?? "bg-slate-100 text-slate-600"} hover:opacity-90 capitalize`}>{type}</Badge>;
  }

  const unread = submissions.filter((s) => !s.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-orange-500" /> {typeFilter === "contact" ? "Contact Messages" : "Form Submissions"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {submissions.length} total {unread > 0 && <span className="text-orange-600 font-medium">· {unread} unread</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!submissions.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            <SelectItem value="contact">Contact</SelectItem>
            <SelectItem value="demo">Demo Request</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-5 gap-4 min-h-[500px]">
        {/* List */}
        <div className="col-span-2 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No submissions yet</p>
            </div>
          ) : (
            submissions.map((s) => (
              <div
                key={s.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.id === s.id ? "border-orange-300 bg-orange-50" : s.isRead ? "border-slate-100 bg-white hover:bg-slate-50" : "border-orange-200 bg-orange-50/50 hover:bg-orange-50"}`}
                onClick={() => { setSelected(s); if (!s.isRead) markReadMutation.mutate(s.id); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!s.isRead && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                      <p className="text-sm font-medium text-slate-800 truncate">{s.name || s.email || "Anonymous"}</p>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{s.email ?? "No email"}</p>
                  </div>
                  {typeBadge(s.formType)}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{format(new Date(s.createdAt), "MMM d, yyyy HH:mm")}</p>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="col-span-3">
          {selected ? (
            <Card className="border-0 shadow-sm h-full">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{selected.name || "Anonymous"}</CardTitle>
                    {selected.email && <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3.5 h-3.5" />{selected.email}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {typeBadge(selected.formType)}
                      <span className="text-xs text-slate-400">{format(new Date(selected.createdAt), "MMM d, yyyy HH:mm")}</span>
                      {selected.isRead && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Read</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm("Delete this submission?") && deleteMutation.mutate(selected.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Submission Data</p>
                <div className="space-y-2">
                  {selected.data && Object.entries(selected.data).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2 last:border-0">
                      <p className="text-xs font-medium text-slate-500 capitalize col-span-1">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm text-slate-800 col-span-2 break-words">{String(v ?? "—")}</p>
                    </div>
                  ))}
                  {(!selected.data || Object.keys(selected.data).length === 0) && <p className="text-sm text-slate-400">No additional data</p>}
                </div>
                {selected.email && (
                  <Button size="sm" className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => window.open(`mailto:${selected.email}`)}>
                    <Mail className="w-4 h-4 mr-1.5" /> Reply via Email
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300">
              <div className="text-center">
                <Eye className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Select a submission to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
