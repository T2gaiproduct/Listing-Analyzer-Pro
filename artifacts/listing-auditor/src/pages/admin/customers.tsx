import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Ban, CheckCircle, Trash2, Eye, Users, PauseCircle, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Customer {
  id: string;
  profileId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  auditCount: number;
}

function customerId(profileId: number | null): string {
  if (!profileId) return "—";
  return `CUST-${String(profileId).padStart(5, "0")}`;
}

function fetchCustomers(q: string): Promise<{ customers: Customer[]; total: number }> {
  return fetch(`${basePath}/api/admin/customers?limit=50&query=${encodeURIComponent(q)}`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", query],
    queryFn: () => fetchCustomers(query),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${ban ? "ban" : "unban"}`, {
        method: "PATCH",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast({ title: "Customer status updated" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: ({ userId, lock }: { userId: string; lock: boolean }) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${lock ? "lock" : "unlock"}`, {
        method: "PATCH",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast({ title: "Suspension status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`${basePath}/api/admin/customers/${userId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast({ title: "Customer deleted" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${data.total} total users` : "Manage all platform users"}
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setQuery(search)}
              />
            </div>
            <Button onClick={() => setQuery(search)} variant="secondary">Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Audits</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Active</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4"><div className="h-10 w-48 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-8 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-5 w-14 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-24 bg-slate-100 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))}
            {!isLoading && data?.customers.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 text-xs font-bold">
                          {(c.firstName?.[0] ?? c.email[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-800">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {customerId(c.profileId)}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold text-slate-700">{c.auditCount}</td>
                <td className="px-4 py-4 text-slate-400 text-xs">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-4 text-slate-400 text-xs">
                  {c.lastSignInAt ? formatDistanceToNow(new Date(c.lastSignInAt), { addSuffix: true }) : "Never"}
                </td>
                <td className="px-4 py-4">
                  {c.banned ? (
                    <Badge variant="destructive" className="text-xs">Banned</Badge>
                  ) : c.locked ? (
                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">Locked</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Active</Badge>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-500 hover:text-slate-900"
                      title="View detail"
                      onClick={() => setLocation(`/admin/customers/${c.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-500 hover:text-yellow-600"
                      title={c.locked ? "Activate (unsuspend)" : "Suspend account"}
                      onClick={() => lockMutation.mutate({ userId: c.id, lock: !c.locked })}
                      disabled={lockMutation.isPending || c.banned}
                    >
                      {c.locked ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-500 hover:text-amber-600"
                      title={c.banned ? "Unban" : "Ban"}
                      onClick={() => banMutation.mutate({ userId: c.id, ban: !c.banned })}
                      disabled={banMutation.isPending}
                    >
                      {c.banned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-500 hover:text-red-600"
                      title="Delete customer"
                      onClick={() => {
                        if (confirm(`Delete ${c.email}? This removes all their audits.`)) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.customers.length && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No customers found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
