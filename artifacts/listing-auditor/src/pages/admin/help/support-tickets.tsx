import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Mail, CheckCircle, Trash2, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SupportTicket {
  id: number;
  formType: string;
  email: string | null;
  name: string | null;
  data: { subject?: string; message?: string } | null;
  isRead: boolean;
  createdAt: string;
}

export default function AdminSupportTickets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["admin-support-tickets"],
    queryFn: () =>
      fetch(`${basePath}/api/admin/forms?type=support`, { credentials: "include" }).then((r) => r.json()),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${basePath}/api/admin/forms/${id}/read`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-support-tickets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/forms/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      setSelected(null);
      toast({ title: "Ticket deleted" });
    },
  });

  function exportCsv() {
    if (!tickets.length) return;
    const rows = [["ID", "Email", "Subject", "Message", "Date", "Read"]];
    for (const t of tickets) {
      rows.push([
        String(t.id),
        t.email ?? "",
        t.data?.subject ?? "",
        t.data?.message ?? "",
        format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
        t.isRead ? "yes" : "no",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "support-tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const unread = tickets.filter((t) => !t.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-orange-500" /> Support Tickets
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {tickets.length} total {unread > 0 && <span className="text-orange-600 font-medium">· {unread} unread</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!tickets.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4 min-h-[500px]">
        <div className="col-span-2 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)
          ) : tickets.length === 0 ? (
            <div className="text-center py-16">
              <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No support tickets yet</p>
              <p className="text-slate-300 text-xs mt-1">Tickets submitted from the Help Center will appear here</p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selected?.id === t.id ? "border-orange-300 bg-orange-50" : t.isRead ? "border-slate-100 bg-white hover:bg-slate-50" : "border-orange-200 bg-orange-50/50 hover:bg-orange-50"}`}
                onClick={() => {
                  setSelected(t);
                  if (!t.isRead) markReadMutation.mutate(t.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!t.isRead && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                      <p className="text-sm font-medium text-slate-800 truncate">{t.data?.subject || "No subject"}</p>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{t.email ?? "No email"}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 hover:opacity-90">Support</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}</p>
              </div>
            ))
          )}
        </div>

        <div className="col-span-3">
          {selected ? (
            <Card className="border-0 shadow-sm h-full">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{selected.data?.subject || "No subject"}</CardTitle>
                    {selected.email && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        {selected.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-amber-100 text-amber-700 hover:opacity-90">Support</Badge>
                      <span className="text-xs text-slate-400">{format(new Date(selected.createdAt), "MMM d, yyyy HH:mm")}</span>
                      {selected.isRead && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-slate-400 hover:text-red-600"
                    onClick={() => confirm("Delete this ticket?") && deleteMutation.mutate(selected.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Message</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selected.data?.message || "No message provided"}
                </p>
                {selected.email && (
                  <Button size="sm" className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => window.open(`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.data?.subject ?? "Support ticket")}`)}>
                    <Mail className="w-4 h-4 mr-1.5" /> Reply via Email
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300">
              <div className="text-center">
                <Eye className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Select a ticket to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
