import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Layers, FlaskConical, Star, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  teamMembers: number;
  creditAllocations: Record<string, number> | null;
  features: string[];
  excludedFeatures: string[];
  isActive: boolean;
  isTrial: boolean;
  trialDays: number;
  tag: string | null;
  sortOrder: number;
  isHighlighted: boolean;
  ctaText: string | null;
}

const emptyPlan = {
  name: "",
  description: "",
  priceMonthly: 0,
  priceYearly: 0,
  auditCredits: 0,
  textContentCredits: 0,
  imageCredits: 0,
  ebcCredits: 0,
  competitorCredits: 0,
  teamMembers: 1,
  featuresText: "",
  excludedFeaturesText: "",
  isTrial: false,
  trialDays: 14,
  tag: "",
  sortOrder: 0,
  isHighlighted: false,
  ctaText: "",
};

const TAG_OPTIONS = ["", "Most Popular", "Best Value", "New", "Recommended", "Limited Offer"];

function PlanForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: typeof emptyPlan;
  onSave: (v: typeof emptyPlan) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const f = (key: keyof typeof emptyPlan) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  return (
    <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
      {/* Name + Description */}
      <div className="col-span-2 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Plan Name *</Label>
          <Input className="mt-1 h-8 text-sm" value={form.name} onChange={f("name")} placeholder="Starter" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input className="mt-1 h-8 text-sm" value={form.description} onChange={f("description")} placeholder="For small sellers" />
        </div>
      </div>

      {/* Pricing */}
      <div>
        <Label className="text-xs">Monthly Price ($)</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.priceMonthly} onChange={f("priceMonthly")} />
      </div>
      <div>
        <Label className="text-xs">Yearly Price ($/mo)</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.priceYearly} onChange={f("priceYearly")} />
      </div>

      {/* Credits per activity */}
      <div>
        <Label className="text-xs">Audit Credits / mo</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.auditCredits} onChange={f("auditCredits")} />
      </div>
      <div>
        <Label className="text-xs">Text Content Credits / mo</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.textContentCredits} onChange={f("textContentCredits")} />
      </div>
      <div>
        <Label className="text-xs">Image Credits / mo</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.imageCredits} onChange={f("imageCredits")} />
      </div>
      <div>
        <Label className="text-xs">A+ / EBC Content Credits / mo</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.ebcCredits} onChange={f("ebcCredits")} />
      </div>
      <div>
        <Label className="text-xs">Competitors Analysis Credits / mo</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.competitorCredits} onChange={f("competitorCredits")} />
      </div>
      <div>
        <Label className="text-xs">Team Members</Label>
        <Input className="mt-1 h-8 text-sm" type="number" value={form.teamMembers} onChange={f("teamMembers")} />
      </div>

      {/* Features */}
      <div className="col-span-2">
        <Label className="text-xs flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500" />Included Features (comma-separated)</Label>
        <Input className="mt-1 h-8 text-sm" value={form.featuresText} onChange={f("featuresText")} placeholder="Competitor comparison, Score breakdown, Priority support" />
      </div>
      <div className="col-span-2">
        <Label className="text-xs flex items-center gap-1.5"><X className="w-3 h-3 text-slate-400" />Excluded / Not Included (comma-separated)</Label>
        <Input className="mt-1 h-8 text-sm" value={form.excludedFeaturesText} onChange={f("excludedFeaturesText")} placeholder="API access, White-label reports, Custom integrations" />
        <p className="text-xs text-slate-400 mt-1">These display with a grey ✗ on the pricing page to show what's not included</p>
      </div>

      {/* Display settings */}
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Badge Tag</Label>
          <select
            className="mt-1 w-full h-8 border border-input rounded-md bg-background px-2 text-sm"
            value={form.tag}
            onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))}
          >
            {TAG_OPTIONS.map((t) => <option key={t} value={t}>{t || "(no tag)"}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">CTA Button Text</Label>
          <Input className="mt-1 h-8 text-sm" value={form.ctaText} onChange={f("ctaText")} placeholder="Start Free Trial" />
        </div>
        <div>
          <Label className="text-xs">Sort Order</Label>
          <Input className="mt-1 h-8 text-sm" type="number" value={form.sortOrder} onChange={f("sortOrder")} />
        </div>
      </div>

      {/* Highlight toggle */}
      <div className="col-span-2">
        <div className="flex items-center gap-4 rounded-lg border border-dashed border-orange-300 bg-orange-50 p-3">
          <Star className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Highlighted Plan</p>
            <p className="text-xs text-slate-500">Show with orange border and shadow on the pricing page</p>
          </div>
          <Switch
            checked={form.isHighlighted}
            onCheckedChange={(v) => setForm((p) => ({ ...p, isHighlighted: v }))}
          />
        </div>
      </div>

      {/* Trial plan */}
      <div className="col-span-2">
        <div className="flex items-center gap-4 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3">
          <FlaskConical className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Free Trial</p>
            <p className="text-xs text-slate-500">Offer a free trial period before billing begins</p>
          </div>
          <Switch
            checked={form.isTrial}
            onCheckedChange={(v) => setForm((p) => ({ ...p, isTrial: v }))}
          />
          {form.isTrial && (
            <div className="flex items-center gap-2 ml-2">
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={form.trialDays}
                min={1}
                onChange={(e) => setForm((p) => ({ ...p, trialDays: Number(e.target.value) }))}
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">days free</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="col-span-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => onSave(form)} disabled={isPending || !form.name}>
          <Check className="w-3.5 h-3.5 mr-1" /> Save Plan
        </Button>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: () => fetch(`${basePath}/api/admin/plans`, { credentials: "include" }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/plans`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); setCreating(false); toast({ title: "Plan created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & object) =>
      fetch(`${basePath}/api/admin/plans/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); setEditingId(null); toast({ title: "Plan updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/plans/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); toast({ title: "Plan deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetch(`${basePath}/api/admin/plans/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  function buildPayload(form: typeof emptyPlan) {
    return {
      name: form.name,
      description: form.description || null,
      priceMonthly: Number(form.priceMonthly),
      priceYearly: Number(form.priceYearly),
      creditAllocations: {
        audit: Number(form.auditCredits),
        content: Number(form.textContentCredits),
        images: Number(form.imageCredits),
        ebc: Number(form.ebcCredits),
        competitors: Number(form.competitorCredits),
        teamMembers: Number(form.teamMembers),
      },
      teamMembers: Number(form.teamMembers),
      features: form.featuresText ? form.featuresText.split(",").map((s) => s.trim()).filter(Boolean) : [],
      excludedFeatures: form.excludedFeaturesText ? form.excludedFeaturesText.split(",").map((s) => s.trim()).filter(Boolean) : [],
      isTrial: form.isTrial,
      trialDays: form.isTrial ? Number(form.trialDays) : 0,
      tag: form.tag || null,
      sortOrder: Number(form.sortOrder),
      isHighlighted: form.isHighlighted,
      ctaText: form.ctaText || null,
    };
  }

  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plans & Packages</h1>
          <p className="text-slate-500 text-sm mt-1">Manage subscription tiers, credit allocations, and trial offers</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> New Plan
        </Button>
      </div>

      {creating && (
        <PlanForm
          initial={emptyPlan}
          onSave={(form) => createMutation.mutate(buildPayload(form))}
          onCancel={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-56 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && plans.length === 0 && !creating && (
        <div className="text-center py-20">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No plans yet</p>
          <p className="text-slate-400 text-sm">Create your first plan to get started</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((plan) =>
          editingId === plan.id ? (
            <div key={plan.id} className="col-span-full">
              <PlanForm
                initial={{
                  name: plan.name,
                  description: plan.description ?? "",
                  priceMonthly: plan.priceMonthly,
                  priceYearly: plan.priceYearly,
                  auditCredits: (plan.creditAllocations as Record<string, number> | null)?.audit ?? plan.auditCredits ?? 0,
                  textContentCredits: (plan.creditAllocations as Record<string, number> | null)?.content ?? 0,
                  imageCredits: (plan.creditAllocations as Record<string, number> | null)?.images ?? plan.imageCredits ?? 0,
                  ebcCredits: (plan.creditAllocations as Record<string, number> | null)?.ebc ?? 0,
                  competitorCredits: (plan.creditAllocations as Record<string, number> | null)?.competitors ?? 0,
                  teamMembers: plan.teamMembers,
                  featuresText: plan.features.join(", "),
                  excludedFeaturesText: (plan.excludedFeatures ?? []).join(", "),
                  isTrial: plan.isTrial,
                  trialDays: plan.trialDays || 14,
                  tag: plan.tag ?? "",
                  sortOrder: plan.sortOrder ?? 0,
                  isHighlighted: plan.isHighlighted ?? false,
                  ctaText: plan.ctaText ?? "",
                }}
                onSave={(form) => updateMutation.mutate({ id: plan.id, ...buildPayload(form) })}
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            </div>
          ) : (
            <Card key={plan.id} className={`border-0 shadow-sm transition-opacity ${plan.isActive ? "" : "opacity-60"} ${plan.isHighlighted ? "ring-2 ring-orange-300" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-bold text-slate-900 truncate flex items-center gap-1.5">
                      {plan.isHighlighted && <Star className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                      {plan.name}
                    </CardTitle>
                    {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge className={plan.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {plan.tag && (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">{plan.tag}</Badge>
                    )}
                    {plan.isTrial && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex items-center gap-1 text-xs">
                        <FlaskConical className="w-3 h-3" />{plan.trialDays}d trial
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <div>
                    <span className="text-2xl font-bold text-slate-900">${plan.priceMonthly}</span>
                    <span className="text-slate-400 text-xs">/mo</span>
                  </div>
                  <div className="text-slate-400 text-xs self-end pb-0.5">· ${plan.priceYearly}/mo yearly</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <ArrowUpDown className="w-3 h-3" /> Order: {plan.sortOrder}
                  {plan.ctaText && <span className="ml-2 text-slate-500">CTA: "{plan.ctaText}"</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(() => {
                    const a = plan.creditAllocations ?? {};
                    const items = [
                      { label: "Audit Credits", value: a.audit ?? plan.auditCredits ?? 0 },
                      { label: "Text Content", value: a.content ?? 0 },
                      { label: "Image Credits", value: a.images ?? plan.imageCredits ?? 0 },
                      { label: "A+ / EBC", value: a.ebc ?? 0 },
                      { label: "Competitors", value: a.competitors ?? 0 },
                      { label: "Team Members", value: plan.teamMembers },
                    ];
                    return items.map((c) => (
                      <div key={c.label} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400">{c.label}</p>
                        <p className="font-bold text-slate-800">{c.value === 999 ? "∞" : c.value}</p>
                      </div>
                    ));
                  })()}
                </div>
                {plan.features.length > 0 && (
                  <ul className="space-y-1">
                    {plan.features.slice(0, 4).map((feat) => (
                      <li key={feat} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0" />{feat}
                      </li>
                    ))}
                    {plan.features.length > 4 && <li className="text-xs text-slate-400">+{plan.features.length - 4} more</li>}
                  </ul>
                )}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setEditingId(plan.id)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => toggleMutation.mutate({ id: plan.id, isActive: !plan.isActive })}
                    disabled={toggleMutation.isPending}
                  >
                    {plan.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600"
                    onClick={() => confirm(`Delete plan "${plan.name}"?`) && deleteMutation.mutate(plan.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
