import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2, Pencil, Check, X, Zap, Image, BarChart3, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CreditPack {
  id: number;
  creditType: string;
  quantity: number;
  priceCents: number;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  ai: "AI Content",
  image: "Image Generation",
  audit: "Audit / Competitor",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  ai: Zap,
  image: Image,
  audit: BarChart3,
};

const TYPE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  ai: { bg: "bg-blue-50", text: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  image: { bg: "bg-purple-50", text: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  audit: { bg: "bg-orange-50", text: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
};

function useCreditPacks() {
  return useQuery<CreditPack[]>({
    queryKey: ["admin-credit-packs"],
    queryFn: () => fetch(`${basePath}/api/admin/credit-packs`, { credentials: "include" }).then((r) => r.json()),
  });
}

export default function AdminCreditPricing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packs = [], isLoading } = useCreditPacks();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<CreditPack>>({});
  const [adding, setAdding] = useState(false);
  const [newPack, setNewPack] = useState<Partial<CreditPack>>({ creditType: "ai", quantity: 10, priceCents: 500, isActive: true, sortOrder: 0 });

  const createMutation = useMutation({
    mutationFn: async (body: Partial<CreditPack>) => {
      const r = await fetch(`${basePath}/api/admin/credit-packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      setAdding(false);
      setNewPack({ creditType: "ai", quantity: 10, priceCents: 500, isActive: true, sortOrder: 0 });
      toast({ title: "Credit pack created" });
    },
    onError: (err) => toast({ title: "Failed to create", description: (err as Error).message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<CreditPack> }) => {
      const r = await fetch(`${basePath}/api/admin/credit-packs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      setEditingId(null);
      toast({ title: "Credit pack updated" });
    },
    onError: (err) => toast({ title: "Failed to update", description: (err as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${basePath}/api/admin/credit-packs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-packs"] });
      toast({ title: "Credit pack deleted" });
    },
    onError: (err) => toast({ title: "Failed to delete", description: (err as Error).message, variant: "destructive" }),
  });

  const grouped = packs.reduce<Record<string, CreditPack[]>>((acc, p) => {
    const t = p.creditType;
    if (!acc[t]) acc[t] = [];
    acc[t].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit Pricing</h1>
          <p className="text-slate-500 text-sm mt-1">Set prices for credit packs customers can purchase. Revenue is yours — Replit cost is separate.</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1.5" /> New Pack
        </Button>
      </div>

      {adding && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Create Credit Pack</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type</label>
              <select
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={newPack.creditType}
                onChange={(e) => setNewPack({ ...newPack, creditType: e.target.value })}
              >
                <option value="ai">AI Content</option>
                <option value="image">Image Generation</option>
                <option value="audit">Audit / Competitor</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Quantity</label>
              <Input type="number" min={1} value={newPack.quantity} onChange={(e) => setNewPack({ ...newPack, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Price ($)</label>
              <Input type="number" min={0} step={0.01} value={(newPack.priceCents ?? 0) / 100} onChange={(e) => setNewPack({ ...newPack, priceCents: Math.round(Number(e.target.value) * 100) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Label</label>
              <Input placeholder="e.g. Starter Pack" value={newPack.label ?? ""} onChange={(e) => setNewPack({ ...newPack, label: e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Sort Order</label>
              <Input type="number" value={newPack.sortOrder} onChange={(e) => setNewPack({ ...newPack, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => createMutation.mutate(newPack)} disabled={createMutation.isPending}>
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICONS[type] ?? Zap;
            const colors = TYPE_COLORS[type] ?? TYPE_COLORS.ai;
            return (
              <div key={type} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{TYPE_LABELS[type] ?? type}</h2>
                    <p className="text-xs text-slate-400">{items.length} pack{items.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Label</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Quantity</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Price</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Sort</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-6 py-3">
                            {isEditing ? (
                              <Input className="h-8 text-sm" value={editValues.label ?? p.label ?? ""} onChange={(e) => setEditValues({ ...editValues, label: e.target.value })} />
                            ) : (
                              <span className="font-medium text-slate-800">{p.label ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input type="number" className="h-8 text-sm w-24 ml-auto" value={editValues.quantity ?? p.quantity} onChange={(e) => setEditValues({ ...editValues, quantity: Number(e.target.value) })} />
                            ) : (
                              <span className="font-semibold text-slate-900">{p.quantity}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input type="number" step={0.01} className="h-8 text-sm w-28 ml-auto" value={((editValues.priceCents ?? p.priceCents) / 100).toFixed(2)} onChange={(e) => setEditValues({ ...editValues, priceCents: Math.round(Number(e.target.value) * 100) })} />
                            ) : (
                              <span className="font-semibold text-slate-900">${(p.priceCents / 100).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select className="h-8 rounded-md border border-slate-200 text-sm px-2" value={editValues.isActive ?? p.isActive ? "true" : "false"} onChange={(e) => setEditValues({ ...editValues, isActive: e.target.value === "true" })}>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            ) : (
                              <Badge className={p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input type="number" className="h-8 text-sm w-20 ml-auto" value={editValues.sortOrder ?? p.sortOrder} onChange={(e) => setEditValues({ ...editValues, sortOrder: Number(e.target.value) })} />
                            ) : (
                              <span className="text-slate-500 text-xs">{p.sortOrder}</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={() => updateMutation.mutate({ id: p.id, body: editValues })} disabled={updateMutation.isPending}>
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400" onClick={() => { setEditingId(null); setEditValues({}); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700" onClick={() => { setEditingId(p.id); setEditValues({}); }}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">No packs for this type</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
          {packs.length === 0 && (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No credit packs configured yet</p>
              <p className="text-slate-400 text-sm mt-1">Click "New Pack" to create your first credit pack.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
