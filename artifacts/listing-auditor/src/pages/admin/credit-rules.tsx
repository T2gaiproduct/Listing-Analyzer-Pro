import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Check, X, Shield, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CreditRule {
  id: number;
  activityName: string;
  featureType: string;
  creditType: string;
  creditsRequired: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  ai: "AI",
  image: "Image",
  audit: "Audit",
};

const TYPE_COLORS: Record<string, { bg: string; badge: string }> = {
  ai: { bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  image: { bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700" },
  audit: { bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700" },
};

function useRules() {
  return useQuery<CreditRule[]>({
    queryKey: ["admin-credit-rules"],
    queryFn: () => fetch(`${basePath}/api/admin/credit-rules`, { credentials: "include" }).then((r) => r.json()),
  });
}

export default function AdminCreditRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useRules();
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState<Partial<CreditRule>>({ creditType: "audit", creditsRequired: 1, isActive: true, sortOrder: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<CreditRule>>({});

  const createMutation = useMutation({
    mutationFn: async (body: Partial<CreditRule>) => {
      const res = await fetch(`${basePath}/api/admin/credit-rules`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-rules"] });
      setAdding(false); setNewRule({ creditType: "audit", creditsRequired: 1, isActive: true, sortOrder: 0 });
      toast({ title: "Credit rule created" });
    },
    onError: (e) => toast({ title: "Failed to create rule", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<CreditRule> }) => {
      const res = await fetch(`${basePath}/api/admin/credit-rules/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-rules"] });
      setEditingId(null); setEditValues({});
      toast({ title: "Rule updated" });
    },
    onError: (e) => toast({ title: "Failed to update rule", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${basePath}/api/admin/credit-rules/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: (e) => toast({ title: "Failed to delete rule", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit Rules</h1>
          <p className="text-slate-500 text-sm mt-1">Manage how many credits each activity costs. Changes apply immediately to all users.</p>
        </div>
        {!adding && (
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Rule
          </Button>
        )}
      </div>

      {adding && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Activity Name</label>
              <Input value={newRule.activityName ?? ""} onChange={(e) => setNewRule({ ...newRule, activityName: e.target.value })} placeholder="e.g. Audit" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Feature Type (key)</label>
              <Input value={newRule.featureType ?? ""} onChange={(e) => setNewRule({ ...newRule, featureType: e.target.value })} placeholder="e.g. audit" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Credit Type</label>
              <select className="h-9 rounded-md border border-slate-200 text-sm px-3 w-full" value={newRule.creditType} onChange={(e) => setNewRule({ ...newRule, creditType: e.target.value })}>
                <option value="audit">Audit</option>
                <option value="ai">AI</option>
                <option value="image">Image</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Credits</label>
              <Input type="number" value={newRule.creditsRequired ?? 1} onChange={(e) => setNewRule({ ...newRule, creditsRequired: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => createMutation.mutate(newRule)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl">
        <ResponsiveTable minWidth="40rem">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Activity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Feature Key</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Credits</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Sort</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const isEditing = editingId === r.id;
              const colors = TYPE_COLORS[r.creditType] ?? TYPE_COLORS.audit;
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input className="h-8 text-sm" value={editValues.activityName ?? r.activityName} onChange={(e) => setEditValues({ ...editValues, activityName: e.target.value })} />
                    ) : (
                      <span className="font-medium text-slate-800">{r.activityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input className="h-8 text-sm" value={editValues.featureType ?? r.featureType} onChange={(e) => setEditValues({ ...editValues, featureType: e.target.value })} />
                    ) : (
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{r.featureType}</code>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select className="h-8 rounded-md border border-slate-200 text-sm px-2" value={editValues.creditType ?? r.creditType} onChange={(e) => setEditValues({ ...editValues, creditType: e.target.value })}>
                        <option value="audit">Audit</option>
                        <option value="ai">AI</option>
                        <option value="image">Image</option>
                      </select>
                    ) : (
                      <Badge className={colors.badge}>{TYPE_LABELS[r.creditType] ?? r.creditType}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <Input type="number" className="h-8 text-sm w-20 ml-auto" value={editValues.creditsRequired ?? r.creditsRequired} onChange={(e) => setEditValues({ ...editValues, creditsRequired: Number(e.target.value) })} />
                    ) : (
                      <span className="font-semibold text-slate-900">{r.creditsRequired}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select className="h-8 rounded-md border border-slate-200 text-sm px-2" value={editValues.isActive ?? r.isActive ? "true" : "false"} onChange={(e) => setEditValues({ ...editValues, isActive: e.target.value === "true" })}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    ) : (
                      <Badge className={r.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>{r.isActive ? "Active" : "Inactive"}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <Input type="number" className="h-8 text-sm w-16 ml-auto" value={editValues.sortOrder ?? r.sortOrder} onChange={(e) => setEditValues({ ...editValues, sortOrder: Number(e.target.value) })} />
                    ) : (
                      <span className="text-slate-500 text-xs">{r.sortOrder}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={() => updateMutation.mutate({ id: r.id, body: editValues })} disabled={updateMutation.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400" onClick={() => { setEditingId(null); setEditValues({}); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700" onClick={() => { setEditingId(r.id); setEditValues({}); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                  No credit rules configured yet. Add your first rule above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </ResponsiveTable>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-1">How it works</p>
          <p className="text-amber-700/80">Feature types are internal keys used by the API. When you change a credit cost, the next user action will use the new value. Old transactions are not affected.</p>
        </div>
      </div>
    </div>
  );
}
