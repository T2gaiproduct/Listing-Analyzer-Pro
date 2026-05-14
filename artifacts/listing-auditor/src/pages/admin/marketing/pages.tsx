import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, Edit2, Trash2, Eye, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CmsPage {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isSystem: boolean;
  createdAt: string;
}

const SYSTEM_PAGES = [
  { title: "Home Page", slug: "home", isSystem: true },
  { title: "Features", slug: "features", isSystem: true },
  { title: "Pricing", slug: "pricing", isSystem: true },
  { title: "About Us", slug: "about", isSystem: true },
  { title: "Contact Us", slug: "contact", isSystem: true },
  { title: "Blog", slug: "blog", isSystem: true },
  { title: "Help Center", slug: "help", isSystem: true },
  { title: "Terms & Conditions", slug: "terms", isSystem: true },
  { title: "Privacy Policy", slug: "privacy", isSystem: true },
  { title: "Enterprise", slug: "enterprise", isSystem: true },
];

const emptyForm = { title: "", slug: "", description: "", seoTitle: "", seoDescription: "", status: "draft", scheduledAt: "" };

export default function AdminMarketingPages() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: pages = [], isLoading } = useQuery<CmsPage[]>({
    queryKey: ["admin-cms-pages"],
    queryFn: () => fetch(`${basePath}/api/admin/cms-pages`, { credentials: "include" }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/cms-pages`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }); setCreating(false); setForm(emptyForm); toast({ title: "Page created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; [k: string]: unknown }) =>
      fetch(`${basePath}/api/admin/cms-pages/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }); setEditingId(null); toast({ title: "Page updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/cms-pages/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }); toast({ title: "Page deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${basePath}/api/admin/cms-pages/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, publishedAt: status === "published" ? new Date().toISOString() : null }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });

  function statusBadge(status: string) {
    if (status === "published") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Published</Badge>;
    if (status === "scheduled") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100"><XCircle className="w-3 h-3 mr-1" />Draft</Badge>;
  }

  function PageForm({ onSave, onCancel, isPending }: { onSave: () => void; onCancel: () => void; isPending: boolean }) {
    const f = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Page Title *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.title} onChange={f("title")} placeholder="My Landing Page" />
            </div>
            <div>
              <Label className="text-xs">URL Slug *</Label>
              <div className="flex items-center mt-1">
                <span className="text-xs text-slate-400 bg-slate-100 border border-r-0 border-slate-200 rounded-l px-2 h-8 flex items-center">/</span>
                <Input className="h-8 text-sm rounded-l-none" value={form.slug} onChange={f("slug")} placeholder="my-landing-page" />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea className="mt-1 text-sm resize-none" rows={2} value={form.description} onChange={f("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "scheduled" && (
              <div>
                <Label className="text-xs">Schedule Date/Time</Label>
                <Input className="mt-1 h-8 text-sm" type="datetime-local" value={form.scheduledAt} onChange={f("scheduledAt")} />
              </div>
            )}
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SEO</p>
            <div>
              <Label className="text-xs">Meta Title</Label>
              <Input className="mt-1 h-8 text-sm" value={form.seoTitle} onChange={f("seoTitle")} />
            </div>
            <div>
              <Label className="text-xs">Meta Description</Label>
              <Textarea className="mt-1 text-sm resize-none" rows={2} value={form.seoDescription} onChange={f("seoDescription")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={onSave} disabled={isPending || !form.title || !form.slug}>Save Page</Button>
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
            <Globe className="w-6 h-6 text-orange-500" /> Page Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage all frontend website pages and their publish status</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setCreating(true); setForm(emptyForm); }} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> New Page
        </Button>
      </div>

      {creating && (
        <PageForm
          onSave={() => createMutation.mutate({ ...form, scheduledAt: form.scheduledAt || null })}
          onCancel={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* System pages */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">System Pages</p>
        <div className="space-y-2">
          {SYSTEM_PAGES.map((sp) => {
            const dbPage = pages.find((p) => p.slug === sp.slug);
            return (
              <div key={sp.slug} className="flex items-center gap-4 bg-white rounded-lg border border-slate-100 px-4 py-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800">{sp.title}</p>
                  <p className="text-xs text-slate-400">/{sp.slug}</p>
                </div>
                {dbPage ? statusBadge(dbPage.status) : <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">Always Live</Badge>}
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => window.open(`/${sp.slug}`, "_blank")}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {dbPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-slate-400 hover:text-orange-600"
                    onClick={() => toggleMutation.mutate({ id: dbPage.id, status: dbPage.status === "published" ? "draft" : "published" })}
                  >
                    {dbPage.status === "published" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom pages */}
      {pages.filter((p) => !p.isSystem).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Custom Pages</p>
          <div className="space-y-2">
            {pages.filter((p) => !p.isSystem).map((page) =>
              editingId === page.id ? (
                <PageForm
                  key={page.id}
                  onSave={() => updateMutation.mutate({ id: page.id, ...form, scheduledAt: form.scheduledAt || null })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              ) : (
                <div key={page.id} className="flex items-center gap-4 bg-white rounded-lg border border-slate-100 px-4 py-3 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800">{page.title}</p>
                    <p className="text-xs text-slate-400">/{page.slug} · Created {format(new Date(page.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  {statusBadge(page.status)}
                  {page.scheduledAt && <span className="text-xs text-slate-400">→ {format(new Date(page.scheduledAt), "MMM d")}</span>}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditingId(page.id); setForm({ title: page.title, slug: page.slug, description: page.description ?? "", seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", status: page.status, scheduledAt: page.scheduledAt ?? "" }); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm(`Delete "${page.title}"?`) && deleteMutation.mutate(page.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}</div>}
    </div>
  );
}
