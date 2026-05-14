import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Pencil, Trash2, Eye, EyeOff, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Testimonial {
  id: number;
  name: string;
  role: string | null;
  company: string | null;
  avatar: string | null;
  content: string;
  rating: number;
  isPublished: boolean;
  isVideo: boolean;
  videoUrl: string | null;
  sortOrder: number;
}

const emptyForm = { name: "", role: "", company: "", avatar: "", content: "", rating: 5, isVideo: false, videoUrl: "", sortOrder: 0 };

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={`w-4 h-4 ${n <= value ? "text-yellow-400 fill-yellow-400" : "text-slate-200"}`} />
        </button>
      ))}
    </div>
  );
}

export default function AdminMarketingTestimonials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery<Testimonial[]>({
    queryKey: ["admin-testimonials"],
    queryFn: () => fetch(`${basePath}/api/admin/testimonials`, { credentials: "include" }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/testimonials`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setCreating(false); setForm(emptyForm); toast({ title: "Testimonial added" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; [k: string]: unknown }) =>
      fetch(`${basePath}/api/admin/testimonials/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); setEditingId(null); toast({ title: "Testimonial updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/testimonials/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); toast({ title: "Testimonial deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      fetch(`${basePath}/api/admin/testimonials/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-testimonials"] }),
  });

  function f(key: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.type === "number" ? Number(e.target.value) as unknown as string : e.target.value }));
  }

  function FormPanel({ onSave, onCancel, isPending }: { onSave: () => void; onCancel: () => void; isPending: boolean }) {
    return (
      <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name} onChange={f("name")} placeholder="Jane Smith" />
            </div>
            <div>
              <Label className="text-xs">Avatar URL</Label>
              <Input className="mt-1 h-8 text-sm" value={form.avatar} onChange={f("avatar")} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Role / Title</Label>
              <Input className="mt-1 h-8 text-sm" value={form.role} onChange={f("role")} placeholder="Head of E-Commerce" />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input className="mt-1 h-8 text-sm" value={form.company} onChange={f("company")} placeholder="Acme Corp" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Testimonial *</Label>
            <Textarea className="mt-1 text-sm resize-none" rows={3} value={form.content} onChange={f("content")} placeholder="What the customer said..." />
          </div>
          <div className="flex items-center gap-6">
            <div>
              <Label className="text-xs block mb-1.5">Rating</Label>
              <StarRating value={form.rating} onChange={(n) => setForm((p) => ({ ...p, rating: n }))} />
            </div>
            <div>
              <Label className="text-xs block mb-1.5">Sort Order</Label>
              <Input className="h-8 w-20 text-sm" type="number" value={form.sortOrder} onChange={f("sortOrder")} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isVideo} onCheckedChange={(v) => setForm((p) => ({ ...p, isVideo: v }))} />
              <Label className="text-xs">Video Testimonial</Label>
            </div>
          </div>
          {form.isVideo && (
            <div>
              <Label className="text-xs">Video URL</Label>
              <Input className="mt-1 h-8 text-sm" value={form.videoUrl} onChange={f("videoUrl")} placeholder="https://youtube.com/..." />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={onSave} disabled={isPending || !form.name || !form.content}>Save</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-orange-500" /> Testimonials
          </h1>
          <p className="text-slate-500 text-sm mt-1">{items.filter((t) => t.isPublished).length} published · {items.length} total</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setCreating(true); setForm(emptyForm); }} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> Add Testimonial
        </Button>
      </div>

      {creating && (
        <FormPanel
          onSave={() => createMutation.mutate({ ...form, videoUrl: form.videoUrl || null, role: form.role || null, company: form.company || null, avatar: form.avatar || null })}
          onCancel={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 && !creating ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No testimonials yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="col-span-full">
                <FormPanel
                  onSave={() => updateMutation.mutate({ id: t.id, ...form, videoUrl: form.videoUrl || null, role: form.role || null, company: form.company || null, avatar: form.avatar || null })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              </div>
            ) : (
              <Card key={t.id} className={`border-0 shadow-sm transition-opacity ${t.isPublished ? "" : "opacity-60"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold text-sm flex-shrink-0">{t.name[0]}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800">{t.name}</p>
                      {(t.role || t.company) && <p className="text-xs text-slate-400">{[t.role, t.company].filter(Boolean).join(" · ")}</p>}
                      <div className="flex gap-0.5 mt-0.5">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}</div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {t.isPublished ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Live</Badge> : <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">Hidden</Badge>}
                      {t.isVideo && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">Video</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 italic line-clamp-3">"{t.content}"</p>
                  <div className="flex gap-1.5 pt-1 border-t border-slate-100">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-orange-600 flex-1 text-xs" onClick={() => { setEditingId(t.id); setForm({ name: t.name, role: t.role ?? "", company: t.company ?? "", avatar: t.avatar ?? "", content: t.content, rating: t.rating, isVideo: t.isVideo, videoUrl: t.videoUrl ?? "", sortOrder: t.sortOrder }); }}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-slate-700 flex-1 text-xs" onClick={() => toggleMutation.mutate({ id: t.id, isPublished: !t.isPublished })}>
                      {t.isPublished ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Hide</> : <><Eye className="w-3.5 h-3.5 mr-1" />Publish</>}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm(`Delete testimonial from ${t.name}?`) && deleteMutation.mutate(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
