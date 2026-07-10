import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, Save, Trash2, Pencil, Plus, X, Eye, EyeOff } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  isPublished: boolean;
  sortOrder: number;
}

type FaqForm = { question: string; answer: string; sortOrder: string; isPublished: boolean };
const emptyForm: FaqForm = { question: "", answer: "", sortOrder: "0", isPublished: true };

function fetchFaqs(): Promise<Faq[]> {
  return fetch(`${basePath}/api/admin/faqs`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminFaqs() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: faqs = [], isLoading } = useQuery({ queryKey: ["admin-faqs"], queryFn: fetchFaqs });

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        question: form.question,
        answer: form.answer,
        sortOrder: Number(form.sortOrder) || 0,
        isPublished: form.isPublished,
      };
      const url = editingId ? `${basePath}/api/admin/faqs/${editingId}` : `${basePath}/api/admin/faqs`;
      return fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then((r) => { if (!r.ok) throw new Error("save failed"); return r.json(); });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast({ title: editingId ? "FAQ updated" : "FAQ added" });
      reset();
    },
    onError: () => toast({ title: "Failed to save FAQ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/faqs/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-faqs"] }); toast({ title: "FAQ deleted" }); },
  });

  const startEdit = (f: Faq) => {
    setEditingId(f.id);
    setForm({ question: f.question, answer: f.answer, sortOrder: String(f.sortOrder), isPublished: f.isPublished });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold text-slate-900">FAQs</h1>
      </div>
      <p className="text-slate-500 text-sm -mt-3">Manage the FAQs shown on the public pricing page.</p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{editingId ? `Edit FAQ #${editingId}` : "Add new FAQ"}</h2>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4 mr-1" />Cancel</Button>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Question</label>
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="What are credits?" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Answer</label>
            <Textarea rows={4} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="Credits are the currency for AI operations…" />
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32">
              <label className="text-sm font-medium mb-1 block">Sort Order</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium mt-5 cursor-pointer">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Published (visible on website)
            </label>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.question.trim() || !form.answer.trim()}>
            {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {saveMutation.isPending ? "Saving…" : editingId ? "Update FAQ" : "Add FAQ"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
        {!isLoading && faqs.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-400">No FAQs yet. Add one above.</CardContent></Card>
        )}
        {faqs.map((f) => (
          <Card key={f.id}>
            <CardContent className="py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">#{f.sortOrder}</span>
                  <p className="font-semibold text-slate-800">{f.question}</p>
                  {f.isPublished
                    ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1"><Eye className="w-3 h-3" />Published</span>
                    : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex items-center gap-1"><EyeOff className="w-3 h-3" />Hidden</span>}
                </div>
                <p className="text-sm text-slate-500 mt-1">{f.answer}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-orange-600" onClick={() => startEdit(f)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm(`Delete this FAQ?`) && deleteMutation.mutate(f.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
