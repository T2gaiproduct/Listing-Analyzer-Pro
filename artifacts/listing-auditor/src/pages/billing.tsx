import { useState } from "react";
import { CreditCard, Download, RefreshCw, Plus, CheckCircle2, Zap, Image, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const currentPlan = {
  name: "Growth",
  price: 79,
  billing: "monthly",
  renewsAt: "June 11, 2026",
  aiCredits: { used: 340, total: 500 },
  imageCredits: { used: 67, total: 100 },
  auditCredits: { used: 32, total: 50 },
};

const plans = [
  { name: "Starter", price: 29, aiCredits: 100, imageCredits: 20, auditCredits: 10 },
  { name: "Growth", price: 79, aiCredits: 500, imageCredits: 100, auditCredits: 50, current: true },
  { name: "Pro", price: 149, aiCredits: 2000, imageCredits: 400, auditCredits: 200 },
];

const addOns = [
  { icon: Zap, name: "AI Content Credits", amount: "100 credits", price: 9, color: "text-blue-500", bg: "bg-blue-50" },
  { icon: Image, name: "Image Generation Credits", amount: "25 images", price: 12, color: "text-purple-500", bg: "bg-purple-50" },
  { icon: BarChart3, name: "Audit Credits", amount: "20 audits", price: 15, color: "text-orange-500", bg: "bg-orange-50" },
];

const invoices = [
  { id: "INV-2026-005", date: "May 1, 2026", amount: "$79.00", status: "Paid" },
  { id: "INV-2026-004", date: "Apr 1, 2026", amount: "$79.00", status: "Paid" },
  { id: "INV-2026-003", date: "Mar 1, 2026", amount: "$79.00", status: "Paid" },
  { id: "INV-2026-002", date: "Feb 1, 2026", amount: "$79.00", status: "Paid" },
  { id: "INV-2026-001", date: "Jan 1, 2026", amount: "$29.00", status: "Paid" },
];

function CreditBar({ label, icon: Icon, used, total, color }: { label: string; icon: any; used: number; total: number; color: string }) {
  const pct = Math.round((used / total) * 100);
  const isLow = pct >= 80;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className={`text-xs font-semibold ${isLow ? "text-red-500" : "text-slate-500"}`}>
          {used} / {total}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Billing() {
  const [tab, setTab] = useState<"overview" | "plans" | "credits" | "history">("overview");
  const [purchasing, setPurchasing] = useState<string | null>(null);

  async function buyAddon(name: string) {
    setPurchasing(name);
    await new Promise(r => setTimeout(r, 1000));
    setPurchasing(null);
    alert(`${name} purchased! Your credits have been added.`);
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
          <p className="text-slate-500 mt-1">Manage your plan, credits, and invoices.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {(["overview", "plans", "credits", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize ${
                tab === t
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {t === "history" ? "Billing History" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Plan card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-slate-900">{currentPlan.name} Plan</h2>
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  </div>
                  <p className="text-slate-500 text-sm">
                    ${currentPlan.price}/month · Renews {currentPlan.renewsAt}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTab("plans")}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Change Plan
                </Button>
              </div>

              <div className="space-y-4">
                <CreditBar label="AI Content Credits" icon={Zap} used={currentPlan.aiCredits.used} total={currentPlan.aiCredits.total} color="text-blue-500" />
                <CreditBar label="Image Generation Credits" icon={Image} used={currentPlan.imageCredits.used} total={currentPlan.imageCredits.total} color="text-purple-500" />
                <CreditBar label="Audit Credits" icon={BarChart3} used={currentPlan.auditCredits.used} total={currentPlan.auditCredits.total} color="text-orange-500" />
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Payment method</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-slate-900 rounded flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Visa ending in 4242</p>
                    <p className="text-xs text-slate-400">Expires 08/2027</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </div>

            {/* Quick add-ons */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Buy more credits</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {addOns.map((a) => (
                  <div key={a.name} className="border border-slate-200 rounded-xl p-4">
                    <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center mb-3`}>
                      <a.icon className={`w-4 h-4 ${a.color}`} />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm mb-0.5">{a.name}</p>
                    <p className="text-xs text-slate-400 mb-3">{a.amount}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={purchasing === a.name}
                      onClick={() => buyAddon(a.name)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      {purchasing === a.name ? "Adding..." : `$${a.price}`}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        {tab === "plans" && (
          <div className="space-y-4">
            <p className="text-slate-500 text-sm">Plan changes take effect immediately. Prorated charges apply.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`border rounded-2xl p-6 ${p.current ? "border-orange-400 shadow-md bg-orange-50/30" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">{p.name}</h3>
                    {p.current && <Badge className="bg-orange-100 text-orange-700 text-xs">Current</Badge>}
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mb-4">${p.price}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                  <div className="space-y-2 mb-5 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.aiCredits} AI credits</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.imageCredits} image credits</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.auditCredits} audit credits</div>
                  </div>
                  <Button
                    className="w-full"
                    variant={p.current ? "outline" : "default"}
                    disabled={p.current}
                  >
                    {p.current ? "Current plan" : p.price > currentPlan.price ? "Upgrade" : "Downgrade"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Enterprise</p>
                <p className="text-slate-500 text-sm">Custom credits, unlimited seats, white-label & dedicated support.</p>
              </div>
              <Button variant="outline">Contact Sales</Button>
            </div>
          </div>
        )}

        {/* Credits */}
        {tab === "credits" && (
          <div className="space-y-5">
            <p className="text-slate-500 text-sm">Top up your credits at any time. Add-on credits never expire after purchase.</p>
            {addOns.map((a) => (
              <div key={a.name} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${a.bg} flex items-center justify-center`}>
                    <a.icon className={`w-6 h-6 ${a.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{a.name}</p>
                    <p className="text-slate-400 text-sm">{a.amount} for ${a.price}</p>
                  </div>
                </div>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={purchasing === a.name}
                  onClick={() => buyAddon(a.name)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {purchasing === a.name ? "Adding..." : `Buy — $${a.price}`}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {tab === "history" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Invoice</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-mono text-slate-700 text-xs">{inv.id}</td>
                    <td className="px-5 py-4 text-slate-600">{inv.date}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{inv.amount}</td>
                    <td className="px-5 py-4">
                      <Badge className="bg-green-100 text-green-700">{inv.status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
