import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, GripVertical, Pencil, Trash2, Navigation, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NavItem {
  id: number;
  label: string;
  href: string;
  location: string;
  sortOrder: number;
  isActive: boolean;
  isCta: boolean;
  opensNewTab: boolean;
}

const emptyForm = { label: "", href: "", location: "header", isActive: true, isCta: false, opensNewTab: false, sortOrder: 0 };

export default function AdminMarketingNavigation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("header");

  const { data: items = [], isLoading } = useQuery<NavItem[]>({
    queryKey: ["admin-nav"],
    queryFn: () => fetch(`${basePath}/api/admin/nav`, { credentials: "include" }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/nav`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-nav"] }); qc.invalidateQueries({ queryKey: ["public-nav"] }); setCreating(false); setForm(emptyForm); toast({ title: "Nav item added" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & object) =>
      fetch(`${basePath}/api/admin/nav/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-nav"] }); qc.invalidateQueries({ queryKey: ["public-nav"] }); setEditingId(null); toast({ title: "Nav item updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/nav/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-nav"] }); qc.invalidateQueries({ queryKey: ["public-nav"] }); toast({ title: "Nav item deleted" }); },
  });

  function NavForm({ onSave, onCancel, isPending }: { onSave: () => void; onCancel: () => void; isPending: boolean }) {
    return (
      <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Features" />
            </div>
            <div>
              <Label className="text-xs">URL / Path *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.href} onChange={(e) => setForm((p) => ({ ...p, href: e.target.value }))} placeholder="/features" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Location</Label>
              <Select value={form.location} onValueChange={(v) => setForm((p) => ({ ...p, location: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="footer">Footer</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort Order</Label>
              <Input className="mt-1 h-8 text-sm" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
              <span className="text-xs text-slate-600">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.isCta} onCheckedChange={(v) => setForm((p) => ({ ...p, isCta: v }))} />
              <span className="text-xs text-slate-600">CTA Button</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.opensNewTab} onCheckedChange={(v) => setForm((p) => ({ ...p, opensNewTab: v }))} />
              <span className="text-xs text-slate-600">New Tab</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={onSave} disabled={isPending || !form.label || !form.href}>Save Item</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function NavList({ location }: { location: string }) {
    const filtered = items.filter((i) => i.location === location || i.location === "both").sort((a, b) => a.sortOrder - b.sortOrder);
    if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>;
    if (!filtered.length) return <p className="text-slate-400 text-sm text-center py-8">No {location} nav items yet</p>;
    return (
      <div className="space-y-1.5">
        {filtered.map((item) =>
          editingId === item.id ? (
            <NavForm
              key={item.id}
              onSave={() => updateMutation.mutate({ id: item.id, ...form })}
              onCancel={() => setEditingId(null)}
              isPending={updateMutation.isPending}
            />
          ) : (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.isActive ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50 opacity-60"} shadow-sm group`}>
              <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  {item.isCta && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">CTA</Badge>}
                  {!item.isActive && <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">Hidden</Badge>}
                  {item.location === "both" && <Badge variant="outline" className="text-xs">Both</Badge>}
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1">{item.href}{item.opensNewTab && <ExternalLink className="w-3 h-3" />}</p>
              </div>
              <span className="text-xs text-slate-300">#{item.sortOrder}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-orange-600" onClick={() => { setEditingId(item.id); setForm({ label: item.label, href: item.href, location: item.location, isActive: item.isActive, isCta: item.isCta, opensNewTab: item.opensNewTab, sortOrder: item.sortOrder }); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm(`Delete "${item.label}"?`) && deleteMutation.mutate(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-6 h-6 text-orange-500" /> Navigation Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage header and footer navigation links</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setCreating(true); setForm({ ...emptyForm, location: activeTab }); }} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> Add Link
        </Button>
      </div>

      {creating && (
        <NavForm onSave={() => createMutation.mutate(form)} onCancel={() => setCreating(false)} isPending={createMutation.isPending} />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="header">Header Nav</TabsTrigger>
          <TabsTrigger value="footer">Footer Links</TabsTrigger>
        </TabsList>
        <TabsContent value="header" className="mt-4"><NavList location="header" /></TabsContent>
        <TabsContent value="footer" className="mt-4"><NavList location="footer" /></TabsContent>
      </Tabs>
    </div>
  );
}
