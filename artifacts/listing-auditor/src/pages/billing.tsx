import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CreditCard, Download, RefreshCw, Plus, CheckCircle2,
  Zap, Image, BarChart3, Clock, CheckCircle, ArrowRight,
  Wallet, Loader2, Calculator, AlertTriangle, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

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
interface Payment { id: number; amount: number; status: string; gateway: string; createdAt: string; planId: number | null; invoiceId?: number | null; }
interface Invoice { id: number; amount: number; status: string; currency: string; items: Array<{ description: string; amount: number; quantity: number }>; paidAt: string | null; createdAt: string; }

interface PaymentConfig {
  defaultGateway: "stripe" | "razorpay" | "paypal";
  currency: string;
  stripe: { enabled: boolean; publishableKey: string; mode: string };
  razorpay: { enabled: boolean; keyId: string };
  paypal: { enabled: boolean; clientId: string; mode: string };
}

interface CreditPack {
  id: number;
  creditType: string;
  quantity: number;
  priceCents: number;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface CreditUsage {
  transactions: { creditType: string; amount: number; reason: string | null; featureType: string | null; createdAt: string }[];
  breakdown: Record<string, { spent: number; earned: number; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CreditBar({ label, icon: Icon, used, total, color, bg }: {
  label: string; icon: React.ElementType; used: number; total: number; color: string; bg: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isLow = pct >= 80;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className={`text-xs font-bold ${isLow ? "text-red-500" : "text-slate-600"}`}>
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Dynamically load the Razorpay checkout script */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as Window & { Razorpay?: unknown }).Razorpay) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(s);
  });
}

function CustomCreditsSection({ balance }: { balance: { ai: number; image: number; audit: number } }) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(50);
  const [buying, setBuying] = useState(false);
  const unitPrice = 0.10;
  const totalCost = quantity * unitPrice;

  async function handleBuy() {
    setBuying(true);
    try {
      const res = await fetch(`${basePath}/api/buy-custom-credits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount: quantity, creditType: "audit" }),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) { toast({ title: "Purchase failed", description: d.error ?? "Please try again.", variant: "destructive" }); }
      else { window.location.href = d.url; }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setBuying(false); }
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-slate-900">Buy Additional Credits</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">Current balance: AI {balance.ai.toLocaleString()} · Images {balance.image.toLocaleString()} · Audits {balance.audit.toLocaleString()}</p>
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Credits Quantity</label>
          <Input type="number" min={10} max={10000} value={quantity} onChange={(e) => setQuantity(Math.max(10, Number(e.target.value)))} className="h-10" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Price per credit</label>
          <div className="h-10 flex items-center px-3 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-900">
            <Calculator className="w-4 h-4 text-slate-400 mr-2" />${unitPrice.toFixed(2)}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Total Cost</label>
          <div className="h-10 flex items-center px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-orange-600">
            ${totalCost.toFixed(2)}
          </div>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white h-10 px-6" disabled={buying} onClick={handleBuy}>
          {buying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Buy Now
        </Button>
      </div>
    </div>
  );
}

function CreditRulesCard() {
  const { data: rules = [] } = useQuery<{ activityName: string; creditsRequired: number; creditType: string; featureType: string }[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`).then((r) => r.json()),
  });

  const typeColors: Record<string, string> = { ai: "text-blue-600 bg-blue-50", image: "text-purple-600 bg-purple-50", audit: "text-orange-600 bg-orange-50" };
  const typeLabels: Record<string, string> = { ai: "AI", image: "Image", audit: "Audit" };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Credit Deduction Rules</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rules.map((r) => (
          <div key={r.featureType} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
            <div>
              <p className="text-sm font-medium text-slate-800">{r.activityName}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColors[r.creditType] ?? "text-slate-600 bg-slate-100"}`}>{typeLabels[r.creditType] ?? r.creditType}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{r.creditsRequired} credits</p>
              <p className="text-xs text-slate-400">${(r.creditsRequired * 0.10).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gateway-aware payment section ───────────────────────────────────────────

interface PaymentSectionProps {
  sub: Subscription;
  config: PaymentConfig;
  onSuccess: () => void;
}

function GatewayBadge({ gateway }: { gateway: string }) {
  const label: Record<string, string> = { stripe: "Stripe", razorpay: "Razorpay", paypal: "PayPal" };
  const colors: Record<string, string> = {
    stripe: "bg-indigo-50 text-indigo-700",
    razorpay: "bg-sky-50 text-sky-700",
    paypal: "bg-yellow-50 text-yellow-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${colors[gateway] ?? "bg-slate-100 text-slate-600"}`}>
      <Wallet className="w-3 h-3" />{label[gateway] ?? gateway}
    </span>
  );
}

function PaymentMethodSection({ sub, config, onSuccess }: PaymentSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const gateway = config.defaultGateway;

  // ── Stripe ───────────────────────────────────────────────────────────────
  async function handleStripe() {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/stripe/setup-card`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({}),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) {
        toast({ title: "Could not start card setup", description: d.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      window.location.href = d.url;
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
    } finally { setLoading(false); }
  }

  // ── Razorpay ─────────────────────────────────────────────────────────────
  async function handleRazorpay() {
    setLoading(true);
    try {
      await loadRazorpayScript();
      const currency = config.currency === "INR" ? "INR" : "USD";
      const amount = currency === "INR" ? 1 : 1; // ₹1 / $1 auth hold
      const res = await fetch(`${basePath}/api/razorpay/create-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount, currency }),
      });
      const order = await res.json() as { orderId?: string; amount?: number; currency?: string; keyId?: string; error?: string };
      if (!res.ok || !order.orderId) {
        toast({ title: "Razorpay setup failed", description: order.error ?? "Please try again.", variant: "destructive" });
        setLoading(false); return;
      }

      const W = window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open(): void } };
      const rz = new W.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "ListingAuditor",
        description: "Add payment method",
        order_id: order.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verify = await fetch(`${basePath}/api/razorpay/verify-payment`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const vd = await verify.json() as { success?: boolean; error?: string };
          if (vd.success) {
            toast({ title: "Payment method added via Razorpay" });
            onSuccess();
          } else {
            toast({ title: "Verification failed", description: vd.error, variant: "destructive" });
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: "#f97316" },
      });
      rz.open();
    } catch (err) {
      toast({ title: "Razorpay error", description: (err as Error).message, variant: "destructive" });
      setLoading(false);
    }
  }

  // ── PayPal ────────────────────────────────────────────────────────────────
  async function handlePayPal() {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/paypal/create-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount: 1, currency: config.currency }),
      });
      const d = await res.json() as { orderId?: string; approvalUrl?: string; error?: string };
      if (!res.ok || !d.approvalUrl) {
        toast({ title: "PayPal setup failed", description: d.error ?? "Please try again.", variant: "destructive" });
        setLoading(false); return;
      }
      sessionStorage.setItem("paypal_order_id", d.orderId ?? "");
      window.location.href = d.approvalUrl;
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
      setLoading(false);
    }
  }

  const handlers: Record<string, () => void> = { stripe: handleStripe, razorpay: handleRazorpay, paypal: handlePayPal };
  const labels: Record<string, string> = { stripe: "Add Card", razorpay: "Add via Razorpay", paypal: "Pay with PayPal" };
  const loadingLabels: Record<string, string> = { stripe: "Redirecting…", razorpay: "Opening…", paypal: "Redirecting to PayPal…" };

  const isGatewayReady = config[gateway]?.enabled;

  if (sub.cardLast4) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-7 bg-slate-900 rounded flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-900">{sub.cardBrand} •••• {sub.cardLast4}</p>
              <GatewayBadge gateway={gateway} />
            </div>
            <p className="text-xs text-slate-400">Auto-renewal {sub.autoRenew ? "enabled" : "disabled"}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handlers[gateway]} disabled={loading || !isGatewayReady}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Update"}
        </Button>
      </div>
    );
  }

  if (!isGatewayReady) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Wallet className="w-4 h-4 text-slate-400" />
        No payment gateway is enabled. Please contact support.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">No payment method on file</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Powered by <GatewayBadge gateway={gateway} />
        </p>
      </div>
      <Button
        size="sm"
        className="bg-orange-500 hover:bg-orange-600"
        onClick={handlers[gateway]}
        disabled={loading}
      >
        {loading
          ? <><RefreshCw className="w-4 h-4 animate-spin mr-1" />{loadingLabels[gateway]}</>
          : <><Plus className="w-4 h-4 mr-1" />{labels[gateway]}</>
        }
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Billing() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"overview" | "plans" | "credits" | "history">("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const paypalCaptureAttempted = useRef(false);

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

  const { data: billingData } = useQuery<{ payments: Payment[]; invoices: Invoice[] }>({
    queryKey: ["billing-history"],
    queryFn: () => fetch(`${basePath}/api/billing-history`, { credentials: "include" }).then((r) => r.json()),
    enabled: tab === "history",
  });
  const payments = billingData?.payments ?? [];
  const invoices = billingData?.invoices ?? [];

  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["payment-config"],
    queryFn: () => fetch(`${basePath}/api/payment-config`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Handle Stripe credit-pack return and custom-credit return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("credit_success");
    const customSuccess = params.get("custom_credit_success");
    const cancelled = params.get("credit_cancel");
    if (success) {
      // pack redirect: credit_success=<packId> — confirm via API and show generic success toast
      fetch(`${basePath}/api/buy-credits/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ sessionId: success }),
      })
        .then((r) => r.json())
        .then((d: { success?: boolean; addedCredits?: number; creditType?: string; error?: string }) => {
          if (d.success) {
            toast({ title: "Credit purchase successful", description: `Added ${d.addedCredits} ${d.creditType} credits.` });
          } else {
            toast({ title: "Credit confirmation failed", description: d.error ?? "Please contact support.", variant: "destructive" });
          }
          void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
          void queryClient.invalidateQueries({ queryKey: ["credit-usage"] });
        })
        .catch(() => toast({ title: "Confirmation error", variant: "destructive" }));
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (customSuccess) {
      fetch(`${basePath}/api/buy-credits/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ sessionId: customSuccess }),
      })
        .then((r) => r.json())
        .then((d: { success?: boolean; addedCredits?: number; creditType?: string; error?: string }) => {
          if (d.success) {
            toast({ title: "Credit purchase successful", description: `Added ${d.addedCredits} ${d.creditType} credits.` });
          } else {
            toast({ title: "Credit confirmation failed", description: d.error ?? "Please contact support.", variant: "destructive" });
          }
          void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
          void queryClient.invalidateQueries({ queryKey: ["credit-usage"] });
        })
        .catch(() => toast({ title: "Confirmation error", variant: "destructive" }));
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (cancelled) {
      toast({ title: "Credit purchase cancelled" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle PayPal return redirect (?paypal_captured=1 or ?paypal_cancelled=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paypal_cancelled")) {
      toast({ title: "PayPal payment cancelled" });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("paypal_captured") && !paypalCaptureAttempted.current) {
      paypalCaptureAttempted.current = true;
      const orderId = sessionStorage.getItem("paypal_order_id");
      sessionStorage.removeItem("paypal_order_id");
      window.history.replaceState({}, "", window.location.pathname);

      if (!orderId) {
        toast({ title: "PayPal order not found", variant: "destructive" }); return;
      }

      fetch(`${basePath}/api/paypal/capture-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ orderId }),
      })
        .then((r) => r.json())
        .then((d: { success?: boolean; payer?: string; error?: string }) => {
          if (d.success) {
            toast({ title: "PayPal payment method added", description: d.payer ? `Linked to ${d.payer}` : undefined });
            void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
          } else {
            toast({ title: "PayPal capture failed", description: d.error, variant: "destructive" });
          }
        })
        .catch(() => toast({ title: "PayPal capture error", variant: "destructive" }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const credits = creditsData?.credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const totalAi = sub?.planAiCredits ?? 0;
  const totalImage = sub?.planImageCredits ?? 0;
  const totalAudit = sub?.planAuditCredits ?? 0;
  const usedAi = Math.max(0, totalAi - credits.aiCredits);
  const usedImage = Math.max(0, totalImage - credits.imageCredits);
  const usedAudit = Math.max(0, totalAudit - credits.auditCredits);
  const lowAi = totalAi > 0 && credits.aiCredits <= Math.max(1, totalAi * 0.15);
  const lowImage = totalImage > 0 && credits.imageCredits <= Math.max(1, totalImage * 0.15);
  const lowAudit = totalAudit > 0 && credits.auditCredits <= Math.max(1, totalAudit * 0.15);

  const { data: creditPacks = [] } = useQuery<CreditPack[]>({
    queryKey: ["credit-packs"],
    queryFn: () => fetch(`${basePath}/api/credit-packs`).then((r) => r.json()),
  });

  const { data: creditUsage } = useQuery<CreditUsage>({
    queryKey: ["credit-usage"],
    queryFn: () => fetch(`${basePath}/api/credit-usage`, { credentials: "include" }).then((r) => r.json()),
    enabled: tab === "credits",
  });

  const [buyingPackId, setBuyingPackId] = useState<number | null>(null);

  function invalidateSub() {
    void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
  }

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

  const defaultConfig: PaymentConfig = {
    defaultGateway: "stripe", currency: "USD",
    stripe: { enabled: true, publishableKey: "", mode: "test" },
    razorpay: { enabled: false, keyId: "" },
    paypal: { enabled: false, clientId: "", mode: "sandbox" },
  };
  const config = paymentConfig ?? defaultConfig;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
        <p className="text-slate-500 mt-1">Manage your plan, credits, and invoices.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(["overview", "plans", "credits", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize ${tab === t ? "border-orange-500 text-orange-500" : "border-transparent text-slate-500 hover:text-slate-900"}`}
          >
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
            <PaymentMethodSection sub={sub} config={config} onSuccess={invalidateSub} />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Buy More Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {creditPacks.slice(0, 6).map((pack) => {
                const iconMap: Record<string, React.ElementType> = { ai: Zap, image: Image, audit: BarChart3 };
                const colorMap: Record<string, { color: string; bg: string }> = { ai: { color: "text-blue-500", bg: "bg-blue-50" }, image: { color: "text-purple-500", bg: "bg-purple-50" }, audit: { color: "text-orange-500", bg: "bg-orange-50" } };
                const Icon = iconMap[pack.creditType] ?? Zap;
                const cls = colorMap[pack.creditType] ?? colorMap.ai;
                return (
                  <div key={pack.id} className="border border-slate-200 rounded-xl p-4">
                    <div className={`w-8 h-8 rounded-lg ${cls.bg} flex items-center justify-center mb-3`}><Icon className={`w-4 h-4 ${cls.color}`} /></div>
                    <p className="font-semibold text-slate-900 text-sm mb-0.5">{pack.label ?? `${pack.quantity} ${pack.creditType} credits`}</p>
                    <p className="text-xs text-slate-400 mb-3">{pack.quantity} {pack.creditType} credits</p>
                    <Button size="sm" variant="outline" className="w-full" disabled={buyingPackId === pack.id}
                      onClick={async () => {
                        setBuyingPackId(pack.id);
                        try {
                          const res = await fetch(`${basePath}/api/buy-credits`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            credentials: "include", body: JSON.stringify({ packId: pack.id }),
                          });
                          const d = await res.json() as { url?: string; error?: string };
                          if (!res.ok || !d.url) { toast({ title: "Purchase failed", description: d.error ?? "Please try again.", variant: "destructive" }); }
                          else { window.location.href = d.url; }
                        } catch { toast({ title: "Network error", variant: "destructive" }); }
                        finally { setBuyingPackId(null); }
                      }}>
                      {buyingPackId === pack.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                      ${(pack.priceCents / 100).toFixed(2)}
                    </Button>
                  </div>
                );
              })}
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
                  <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent}
                    onClick={() => !isCurrent && toast({ title: "Plan change", description: "To change your plan, please use the onboarding flow." })}>
                    {isCurrent ? "Current plan" : p.priceMonthly > (sub?.priceMonthly ?? 0) ? "Upgrade" : "Downgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "credits" && (
        <div className="space-y-6">
          {(lowAi || lowImage || lowAudit) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Low Credits Warning</p>
                <p className="text-red-600/80 text-xs mt-0.5">
                  {lowAi && "AI credits are running low. "}
                  {lowImage && "Image credits are running low. "}
                  {lowAudit && "Audit credits are running low. "}
                  Purchase more to avoid interruptions.
                </p>
              </div>
            </div>
          )}
          <p className="text-slate-500 text-sm">Top up your credits at any time. Add-on credits never expire after purchase. 1 credit = $0.10</p>
          <CustomCreditsSection balance={{ ai: credits.aiCredits ?? 0, image: credits.imageCredits ?? 0, audit: credits.auditCredits ?? 0 }} />
          <CreditRulesCard />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditPacks.map((pack) => {
              const iconMap: Record<string, React.ElementType> = { ai: Zap, image: Image, audit: BarChart3 };
              const colorMap: Record<string, { color: string; bg: string }> = { ai: { color: "text-blue-500", bg: "bg-blue-50" }, image: { color: "text-purple-500", bg: "bg-purple-50" }, audit: { color: "text-orange-500", bg: "bg-orange-50" } };
              const Icon = iconMap[pack.creditType] ?? Zap;
              const cls = colorMap[pack.creditType] ?? colorMap.ai;
              return (
                <div key={pack.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${cls.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-6 h-6 ${cls.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{pack.label ?? `${pack.quantity} ${pack.creditType} credits`}</p>
                      <p className="text-slate-400 text-sm">{pack.quantity} {pack.creditType} credits · ${(pack.priceCents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={buyingPackId === pack.id}
                    onClick={async () => {
                      setBuyingPackId(pack.id);
                      try {
                        const res = await fetch(`${basePath}/api/buy-credits`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          credentials: "include", body: JSON.stringify({ packId: pack.id }),
                        });
                        const d = await res.json() as { url?: string; error?: string };
                        if (!res.ok || !d.url) { toast({ title: "Purchase failed", description: d.error ?? "Please try again.", variant: "destructive" }); }
                        else { window.location.href = d.url; }
                      } catch { toast({ title: "Network error", variant: "destructive" }); }
                      finally { setBuyingPackId(null); }
                    }}>
                    {buyingPackId === pack.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Buy — ${(pack.priceCents / 100).toFixed(2)}
                  </Button>
                </div>
              );
            })}
            {creditPacks.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white border border-slate-200 rounded-2xl">
                <p className="text-slate-400">No credit packs available yet.</p>
              </div>
            )}
          </div>

          {/* Transaction history */}
          {creditUsage && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Credit Transaction History</h2>
                <span className="text-xs text-slate-400">{creditUsage.transactions.length} entries</span>
              </div>
              {creditUsage.transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No transactions yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Reason</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">Credits</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditUsage.transactions.map((tx) => {
                      const isSpend = tx.amount < 0;
                      const amountAbs = Math.abs(tx.amount);
                      const typeLabel = isSpend ? "Spent" : "Earned";
                      const typeColor = isSpend ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700";
                      const typeIcon = isSpend ? "-" : "+";
                      return (
                        <tr key={`${tx.createdAt}-${tx.reason}-${tx.amount}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium uppercase">{tx.creditType}</span>
                              <Badge className={typeColor + " text-xs"}>{typeLabel}</Badge>
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-700 max-w-[240px] truncate" title={tx.reason ?? ""}>
                            {tx.reason ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">
                            <span className={isSpend ? "text-red-500" : "text-green-600"}>{typeIcon}{amountAbs}</span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500 text-xs">{isSpend ? `-${amountAbs}` : `+${amountAbs}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Usage breakdown */}
          {creditUsage && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Credit Usage Breakdown</h2>
              </div>
              {Object.keys(creditUsage.breakdown).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No usage yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Feature</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Spent</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Earned</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(creditUsage.breakdown).map(([feature, data]) => (
                      <tr key={feature} className="border-b border-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800 capitalize">{feature.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-semibold">{data.spent}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{data.earned}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{data.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-6">
          {/* Payments */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-semibold text-slate-700 text-sm">Payments</h3>
            </div>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">No payments yet</p>
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
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-mono text-slate-700 text-xs">TXN-{String(p.id).padStart(6, "0")}</td>
                      <td className="px-5 py-4"><GatewayBadge gateway={p.gateway} /></td>
                      <td className="px-5 py-4 font-semibold text-slate-900">${p.amount.toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <Badge className={p.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>{p.status}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{format(new Date(p.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          window.open(`${basePath}/api/receipts/${p.id}`, "_blank");
                        }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Invoices */}
          {invoices.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700 text-sm">Invoices</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Invoice #</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Items</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Amount</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-mono text-slate-700 text-xs">INV-{String(inv.id).padStart(6, "0")}</td>
                      <td className="px-5 py-4 text-slate-600 text-xs">{inv.items.map((i) => i.description).join(", ")}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">${inv.amount.toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <Badge className={inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>{inv.status}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          window.open(`${basePath}/api/receipts/${inv.id}`, "_blank");
                        }}>
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
      )}
    </div>
  );
}
