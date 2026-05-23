import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CreditCard, Download, RefreshCw, Plus, CheckCircle2, Zap, Image, BarChart3, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Subscription {
  status: string;
  planId: number;
  planName: string | null;
  billingCycle: string;
  priceMonthly: number;
  priceYearly: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  autoRenew: boolean;
  planAiCredits: number;
  planImageCredits: number;
  planAuditCredits: number;
}

interface Credits { aiCredits: number; imageCredits: number; auditCredits: number; }
interface Plan { id: number; name: string; priceMonthly: number; priceYearly: number; aiCredits: number; imageCredits: number; auditCredits: number; isHighlighted: boolean; tag: string | null; }
interface Payment { id: number; amount: number; status: string; gateway: string; createdAt: string; planId: number | null; }

function CreditBar({ label, icon: Icon, used, total, color, bg }: { label: string; icon: React.ElementType; used: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isLow = pct >= 80;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className={`text-xs font-bold ${isLow ? "text-red-500" : "text-slate-600"}`}>{used.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Billing() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"overview" | "plans" | "credits" | "history">("overview");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const { toast } = useToast();

  async function handleAddCard() {
    setIsAddingCard(true);
    try {
      const res = await fetch(`${basePath}/api/stripe/setup-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast({ title: "Could not start card setup", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setIsAddingCard(false);
    }
  }

  const { data: sub, isLoading: subLoading } = useQuery<Subscription | null>({
    queryKey: ["user-subscription"],
    queryFn: () => fetch(`${basePath}/api/subscription`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: creditsData } = useQuery<{ credits: Credits }>({
    queryKey: ["user-credits"],
    queryFn: () => fetch(`${basePath}/api/credits`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const { data: history = [] } = useQuery<Payment[]>({
    queryKey: ["billing-history"],
    queryFn: () => fetch(`${basePath}/api/billing-history`, { credentials: "include" }).then((r) => r.json()),
    enabled: tab === "history",
  });

  const credits = creditsData?.credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const totalAi = sub?.planAiCredits ?? 0;
  const totalImage = sub?.planImageCredits ?? 0;
  const totalAudit = sub?.planAuditCredits ?? 0;
  const usedAi = Math.max(0, totalAi - credits.aiCredits);
  const usedImage = Math.max(0, totalImage - credits.imageCredits);
  const usedAudit = Math.max(0, totalAudit - credits.auditCredits);

  const addOns = [
    { icon: Zap, name: "AI Content Credits", amount: "100 credits", price: 9, color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Image, name: "Image Generation Credits", amount: "25 images", price: 12, color: "text-purple-500", bg: "bg-purple-50" },
    { icon: BarChart3, name: "Audit Credits", amount: "20 audits", price: 15, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  if (subLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  if (!sub) {
    return (
      <div className="text-center py-20">
        <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">No active subscription</h2>
        <p className="text-slate-500 mb-6">Choose a plan to unlock your AI-powered listing audits</p>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/onboarding")}>
          <ArrowRight className="w-4 h-4 mr-2" /> Choose a Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
        <p className="text-slate-500 mt-1">Manage your plan, credits, and invoices.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(["overview", "plans", "credits", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize ${tab === t ? "border-orange-500 text-orange-500" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
            {t === "history" ? "Billing History" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-slate-900">{sub.planName ?? "Unknown"} Plan</h2>
                  {sub.status === "active" && <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>}
                  {sub.status === "trial" && <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />Free Trial</Badge>}
                </div>
                <p className="text-slate-500 text-sm">
                  ${sub.billingCycle === "yearly" ? sub.priceYearly : sub.priceMonthly}/month
                  {sub.billingCycle === "yearly" && <span className="text-slate-400"> (billed yearly)</span>}
                  {" · "}
                  {sub.status === "trial" && sub.trialEndsAt
                    ? `Trial ends ${format(new Date(sub.trialEndsAt), "MMM d, yyyy")}`
                    : sub.currentPeriodEnd
                      ? `Renews ${format(new Date(sub.currentPeriodEnd), "MMM d, yyyy")}`
                      : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTab("plans")}><RefreshCw className="w-4 h-4 mr-2" />Change Plan</Button>
            </div>
            {sub.status === "trial" && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                Your free trial {sub.trialEndsAt ? `ends ${format(new Date(sub.trialEndsAt), "MMM d")}` : "is active"}. Add a payment method to continue after the trial.
              </div>
            )}
            <div className="space-y-4">
              <CreditBar label="AI Content Credits" icon={Zap} used={usedAi} total={totalAi} color="text-blue-500" bg="bg-blue-50" />
              <CreditBar label="Image Generation Credits" icon={Image} used={usedImage} total={totalImage} color="text-purple-500" bg="bg-purple-50" />
              <CreditBar label="Audit Credits" icon={BarChart3} used={usedAudit} total={totalAudit} color="text-orange-500" bg="bg-orange-50" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Payment Method</h2>
            {sub.cardLast4 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-slate-900 rounded flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{sub.cardBrand} ending in {sub.cardLast4}</p>
                    <p className="text-xs text-slate-400">Auto-renewal {sub.autoRenew ? "enabled" : "disabled"}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddCard} disabled={isAddingCard}>
                  {isAddingCard ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Update"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">No payment method on file</p>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={handleAddCard} disabled={isAddingCard}>
                  {isAddingCard ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {isAddingCard ? "Redirecting…" : "Add Card"}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Buy More Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {addOns.map((a) => (
                <div key={a.name} className="border border-slate-200 rounded-xl p-4">
                  <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center mb-3`}><a.icon className={`w-4 h-4 ${a.color}`} /></div>
                  <p className="font-semibold text-slate-900 text-sm mb-0.5">{a.name}</p>
                  <p className="text-xs text-slate-400 mb-3">{a.amount}</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => toast({ title: "Coming soon", description: "Add-on credits will be available shortly." })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />${a.price}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">Plan changes take effect immediately. Prorated charges apply.</p>
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(plans.length, 3)} gap-5`}>
            {plans.map((p) => {
              const isCurrent = p.id === sub?.planId;
              return (
                <div key={p.id} className={`border rounded-2xl p-6 relative ${isCurrent ? "border-orange-400 shadow-md bg-orange-50/30" : "border-slate-200"}`}>
                  {p.tag && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">{p.tag}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">{p.name}</h3>
                    {isCurrent && <Badge className="bg-orange-100 text-orange-700 text-xs">Current</Badge>}
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mb-4">${p.priceMonthly}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                  <div className="space-y-2 mb-5 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.aiCredits} AI credits</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.imageCredits} image credits</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.auditCredits === 999 ? "Unlimited" : p.auditCredits} audit credits</div>
                  </div>
                  <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent} onClick={() => !isCurrent && toast({ title: "Plan change", description: "To change your plan, please use the onboarding flow." })}>
                    {isCurrent ? "Current plan" : p.priceMonthly > (sub?.priceMonthly ?? 0) ? "Upgrade" : "Downgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "credits" && (
        <div className="space-y-5">
          <p className="text-slate-500 text-sm">Top up your credits at any time. Add-on credits never expire after purchase.</p>
          {addOns.map((a) => (
            <div key={a.name} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${a.bg} flex items-center justify-center`}><a.icon className={`w-6 h-6 ${a.color}`} /></div>
                <div>
                  <p className="font-semibold text-slate-900">{a.name}</p>
                  <p className="text-slate-400 text-sm">{a.amount} for ${a.price}</p>
                </div>
              </div>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => toast({ title: "Coming soon", description: "Add-on credit purchases will be available shortly." })}>
                <Plus className="w-4 h-4 mr-2" />Buy — ${a.price}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Download className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">No billing history yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Transaction</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Method</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-mono text-slate-700 text-xs">TXN-{String(p.id).padStart(6, "0")}</td>
                    <td className="px-5 py-4 text-slate-600 capitalize">{p.gateway}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">${p.amount.toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <Badge className={p.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>{p.status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{format(new Date(p.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-5 py-4 text-right"><Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
