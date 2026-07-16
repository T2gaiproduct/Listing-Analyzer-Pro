import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
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
import { BillingOverview } from "@/components/billing-overview";
import { refetchCreditQueries } from "@/lib/credit-queries";
import { useCreditPurchaseReturn } from "@/hooks/use-credit-purchase-return";
import { useTeam } from "@/hooks/use-team";

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
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  autoRenew: boolean;
  couponCode: string | null;
  discountAmount: number | null;
  planAiCredits: number;
  planImageCredits: number;
  planAuditCredits: number;
  stripeSubscriptionId: string | null;
}

interface Credits { aiCredits: number; imageCredits: number; auditCredits: number; }
interface Plan { id: number; name: string; priceMonthly: number; priceYearly: number; aiCredits: number; imageCredits: number; auditCredits: number; isHighlighted: boolean; tag: string | null; features?: string[]; }
interface Payment { id: number; amount: number; status: string; gateway: string; createdAt: string; planId: number | null; invoiceId?: number | null; couponCode?: string | null; discountAmount?: number | null; }
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

function CustomCreditsSection({ balance, config }: { balance: { ai: number; image: number; audit: number }; config: PaymentConfig }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(50);
  const [creditType, setCreditType] = useState("ai");
  const [buying, setBuying] = useState(false);
  const unitPrice = 0.10;
  const totalCost = quantity * unitPrice;

  async function handleBuy() {
    setBuying(true);
    try {
      const gateway = config.defaultGateway;
      const res = await fetch(`${basePath}/api/buy-custom-credits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ amount: quantity, creditType, paymentMethod: gateway, origin: window.location.origin }),
      });
      const d = await res.json() as {
        url?: string; error?: string;
        orderId?: string; approvalUrl?: string; clientId?: string;
        amount?: number; currency?: string; keyId?: string;
      };
      if (!res.ok) { toast({ title: "Purchase failed", description: d.error ?? "Please try again.", variant: "destructive" }); return; }

      if (gateway === "stripe") {
        if (d.url) window.location.href = d.url;
        else toast({ title: "Purchase failed", description: "No checkout URL.", variant: "destructive" });
        return;
      }

      if (gateway === "paypal") {
        if (d.approvalUrl) {
          localStorage.setItem("paypal_order_id", d.orderId ?? "");
          localStorage.setItem("paypal_credit_type", creditType);
          localStorage.setItem("paypal_credit_amount", String(quantity));
          window.location.href = d.approvalUrl;
        } else {
          toast({ title: "Purchase failed", description: "No PayPal approval URL.", variant: "destructive" });
        }
        return;
      }

      if (gateway === "razorpay") {
        if (!d.orderId || !d.keyId) { toast({ title: "Purchase failed", description: "No Razorpay order.", variant: "destructive" }); return; }
        await loadRazorpayScript();
        const rzp = new (window as Window & { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay!({
          key: d.keyId,
          amount: d.amount,
          currency: d.currency,
          name: "ListingAuditor",
          description: `${quantity} ${creditType} credits`,
          order_id: d.orderId,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            const verify = await fetch(`${basePath}/api/razorpay/verify-payment`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                creditType, creditAmount: quantity,
              }),
            });
            const vd = await verify.json() as { success?: boolean; addedCredits?: number; error?: string };
            if (vd.success) {
              toast({ title: "Credit purchase successful", description: `Added ${vd.addedCredits} ${creditType} credits.` });
              void refetchCreditQueries(queryClient);
            } else {
              toast({ title: "Payment verification failed", description: vd.error ?? "Please contact support.", variant: "destructive" });
            }
          },
        });
        rzp.open();
      }
    } catch (e) { toast({ title: "Network error", description: (e as Error).message, variant: "destructive" }); }
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
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Credit Type</label>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
            value={creditType}
            onChange={(e) => setCreditType(e.target.value)}
          >
            <option value="ai">AI Credits</option>
            <option value="image">Image Credits</option>
            <option value="audit">Audit Credits</option>
          </select>
        </div>
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
        credentials: "include", body: JSON.stringify({ amount: 1, currency: config.currency, origin: window.location.origin }),
      });
      const d = await res.json() as { orderId?: string; approvalUrl?: string; error?: string };
      if (!res.ok || !d.approvalUrl) {
        toast({ title: "PayPal setup failed", description: d.error ?? "Please try again.", variant: "destructive" });
        setLoading(false); return;
      }
      localStorage.setItem("paypal_order_id", d.orderId ?? "");
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

function MemberBillingView() {
  const { membership, memberCredits, role } = useTeam();

  const { data: usage, isLoading } = useQuery<{
    workspaceName: string;
    planName: string | null;
    periodStart: string;
    periodEnd: string;
    creditsUsed: number;
    remainingCredits: Credits;
    totalAllocatedCredits: number;
    allocatedCredits: Credits;
    workspacePlanTotal: number;
  }>({
    queryKey: ["team-member-usage"],
    queryFn: () =>
      fetch(`${basePath}/api/team/membership/usage`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load usage");
        return r.json();
      }),
  });

  const remaining = memberCredits ?? usage?.remainingCredits ?? usage?.allocatedCredits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const remainingTotal = remaining.aiCredits + remaining.imageCredits + remaining.auditCredits;
  const used = usage?.creditsUsed ?? 0;
  const totalAllocated = usage?.totalAllocatedCredits ?? (remainingTotal + used);
  const usagePct = totalAllocated > 0 ? Math.min(100, Math.round((used / totalAllocated) * 100)) : 0;

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Usage</h1>
        <p className="text-slate-500 mt-1">
          You are a <span className="font-medium capitalize">{role}</span> on{" "}
          <span className="font-medium text-slate-700">{usage?.workspaceName ?? membership?.workspaceName ?? "this workspace"}</span>.
          Credits are managed by the workspace owner.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-base font-bold text-slate-900">Your credit budget</h3>
          <p className="text-sm text-slate-500 mt-1">Credits assigned to you by the workspace owner this billing period.</p>
          {totalAllocated > 0 ? (
            <>
              <p className="text-3xl font-bold text-orange-600 mt-4">
                {remainingTotal.toLocaleString()}{" "}
                <span className="text-lg font-semibold text-slate-500">credits remaining</span>
              </p>
              <p className="text-sm text-slate-600 mt-1">
                of {totalAllocated.toLocaleString()} allocated by owner
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {remaining.auditCredits} audit · {remaining.aiCredits} text · {remaining.imageCredits} images left
              </p>
              <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${usagePct}%` }} />
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {used.toLocaleString()} used · {remainingTotal.toLocaleString()} remaining ({usagePct}% of allocation)
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600 mt-4">
              No credits allocated yet. Ask your workspace owner to assign credits on the Team page.
            </p>
          )}
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6">
          <h3 className="text-base font-bold text-slate-900">Workspace plan</h3>
          <p className="text-sm font-semibold text-slate-800 mt-1">{usage?.planName ?? "—"} Plan</p>
          <p className="text-sm text-slate-500 mt-3">
            Billing period:{" "}
            {usage?.periodStart && usage?.periodEnd
              ? `${format(new Date(usage.periodStart), "MMM d, yyyy")} – ${format(new Date(usage.periodEnd), "MMM d, yyyy")}`
              : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Subscription and upgrades are managed by the workspace owner. Contact them to request more credits.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type BillingTab = "overview" | "plans" | "credits" | "history";

function parseBillingTab(search: string): BillingTab {
  const value = new URLSearchParams(search).get("tab");
  if (value === "plans" || value === "credits" || value === "history" || value === "overview") return value;
  return "overview";
}

function billingTabPath(tab: BillingTab): string {
  return tab === "overview" ? "/billing" : `/billing?tab=${tab}`;
}

export default function Billing() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { isTeamMember, isOwner, isLoading: teamLoading } = useTeam();
  const [tab, setTab] = useState<BillingTab>(() => parseBillingTab(window.location.search));
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const paypalCaptureAttempted = useRef(false);
  useCreditPurchaseReturn();

  const selectTab = (next: BillingTab) => {
    setTab(next);
    setLocation(billingTabPath(next));
  };

  useEffect(() => {
    setTab(parseBillingTab(search));
  }, [location, search]);

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
      const orderId = localStorage.getItem("paypal_order_id");
      const planId = localStorage.getItem("paypal_plan_id");
      const billingCycle = localStorage.getItem("paypal_billing_cycle");
      const creditType = localStorage.getItem("paypal_credit_type");
      const creditAmount = localStorage.getItem("paypal_credit_amount");
      const packId = localStorage.getItem("paypal_pack_id");
      localStorage.removeItem("paypal_order_id");
      localStorage.removeItem("paypal_plan_id");
      localStorage.removeItem("paypal_billing_cycle");
      localStorage.removeItem("paypal_credit_type");
      localStorage.removeItem("paypal_credit_amount");
      localStorage.removeItem("paypal_pack_id");
      window.history.replaceState({}, "", window.location.pathname);

      if (!orderId) {
        toast({ title: "PayPal order not found", variant: "destructive" }); return;
      }

      fetch(`${basePath}/api/paypal/capture-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({
          orderId,
          ...(planId ? { planId: Number(planId) } : {}),
          ...(billingCycle ? { billingCycle } : {}),
          ...(creditType ? { creditType } : {}),
          ...(creditAmount ? { creditAmount: Number(creditAmount) } : {}),
          ...(packId ? { packId: Number(packId) } : {}),
        }),
      })
        .then((r) => r.json())
        .then((d: { success?: boolean; payer?: string; addedCredits?: number; creditType?: string; error?: string }) => {
          if (d.success) {
            if (d.addedCredits) {
              toast({ title: "Credit purchase successful", description: `Added ${d.addedCredits} ${d.creditType} credits.` });
            } else {
              toast({ title: planId ? "Subscription activated" : "PayPal payment method added", description: d.payer ? `Linked to ${d.payer}` : undefined });
            }
            void refetchCreditQueries(queryClient);
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
  const lowAi = totalAi > 0 && credits.aiCredits <= Math.max(1, totalAi * 0.15);
  const lowImage = totalImage > 0 && credits.imageCredits <= Math.max(1, totalImage * 0.15);
  const lowAudit = totalAudit > 0 && credits.auditCredits <= Math.max(1, totalAudit * 0.15);

  const { data: creditPacks = [] } = useQuery<CreditPack[]>({
    queryKey: ["credit-packs"],
    queryFn: () => fetch(`${basePath}/api/credit-packs`).then((r) => r.json()),
  });

  const { data: creditUsage } = useQuery<CreditUsage>({
    queryKey: ["credit-usage"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/credit-usage`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load credit usage");
      const data = await res.json() as CreditUsage;
      return {
        transactions: data.transactions ?? [],
        breakdown: data.breakdown ?? {},
      };
    },
    enabled: tab === "credits" || tab === "overview",
  });

  const creditTransactions = creditUsage?.transactions ?? [];
  const creditBreakdown = creditUsage?.breakdown ?? {};

  const [buyingPackId, setBuyingPackId] = useState<number | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [changePlanId, setChangePlanId] = useState<number | null>(null);
  const [changePlanCycle, setChangePlanCycle] = useState<"monthly" | "yearly">("monthly");

  function invalidateSub() {
    void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
    void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  }

  if (subLoading || teamLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  if (isTeamMember && !isOwner) {
    return <MemberBillingView />;
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
            onClick={() => selectTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize ${tab === t ? "border-orange-500 text-orange-500" : "border-transparent text-slate-500 hover:text-slate-900"}`}
          >
            {t === "history" ? "Billing History" : t === "credits" ? "Buy Credits" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <BillingOverview
          sub={sub}
          plans={plans}
          credits={credits}
          creditUsage={creditUsage}
          onAddCredits={() => selectTab("credits")}
          onUpgradePlan={() => selectTab("plans")}
          paymentSection={<PaymentMethodSection sub={sub} config={config} onSuccess={invalidateSub} />}
        />
      )}

      {tab === "plans" && (
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">Plan changes take effect immediately. Prorated charges apply.</p>
          <div className="space-y-4">
            {plans.map((p) => {
              const isCurrent = p.id === sub?.planId;
              const monthlySelected = p.id === changePlanId && changePlanCycle === "monthly";
              const yearlySelected = p.id === changePlanId && changePlanCycle === "yearly";
              return (
                <div key={p.id} className={`border rounded-2xl p-6 relative ${isCurrent ? "border-orange-400 shadow-md bg-orange-50/30" : "border-slate-200"}`}>
                  {p.tag && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">{p.tag}</span>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{p.name}</h3>
                        {isCurrent && <Badge className="bg-orange-100 text-orange-700 text-xs">Current</Badge>}
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.aiCredits} AI credits</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.imageCredits} image credits</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />{p.auditCredits === 999 ? "Unlimited" : p.auditCredits} audit credits</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setChangePlanId(p.id); setChangePlanCycle("monthly"); }}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2 transition-all ${monthlySelected ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <span className="text-sm font-bold text-slate-900">${p.priceMonthly}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        {monthlySelected && <span className="w-2 h-2 rounded-full bg-orange-500 mt-0.5" />}
                      </button>
                      <button
                        onClick={() => { setChangePlanId(p.id); setChangePlanCycle("yearly"); }}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2 transition-all ${yearlySelected ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <span className="text-sm font-bold text-slate-900">${p.priceYearly}</span>
                        <span className="text-xs text-slate-400">/year</span>
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Save 20%</span>
                        {yearlySelected && <span className="w-2 h-2 rounded-full bg-orange-500 mt-0.5" />}
                      </button>
                    </div>
                    <Button
                      className="w-32"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || changingPlan || (!monthlySelected && !yearlySelected)}
                      onClick={() => {
                        if (isCurrent) return;
                        setChangingPlan(true);
                        const newPlan = plans.find((p) => p.id === changePlanId);
                        const newPlanPrice = changePlanCycle === "yearly" ? (newPlan?.priceYearly ?? 0) * 12 : (newPlan?.priceMonthly ?? 0);
                        if (newPlanPrice === 0) {
                          // Free plan — activate directly
                          fetch(`${basePath}/api/subscription/upgrade`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            credentials: "include", body: JSON.stringify({ planId: changePlanId, billingCycle: changePlanCycle }),
                          })
                            .then((r) => r.json() as Promise<{ success?: boolean; error?: string }>)
                            .then((d) => {
                              if (d.success) {
                                toast({ title: "Plan updated successfully!" });
                                invalidateSub();
                                void queryClient.invalidateQueries({ queryKey: ["user-credits"] });
                                void queryClient.invalidateQueries({ queryKey: ["credit-usage"] });
                              } else {
                                toast({ title: "Could not update plan", description: d.error ?? "Please try again.", variant: "destructive" });
                              }
                            })
                            .catch(() => toast({ title: "Network error", variant: "destructive" }))
                            .finally(() => setChangingPlan(false));
                          return;
                        }
                        if (sub?.stripeSubscriptionId) {
                          // Existing Stripe subscription — redirect to customer portal
                          fetch(`${basePath}/api/stripe/portal`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            credentials: "include", body: JSON.stringify({ returnUrl: `${window.location.origin}${basePath}/billing` }),
                          })
                            .then((r) => r.json() as Promise<{ url?: string; error?: string }>)
                            .then((d) => {
                              if (d.url) window.location.href = d.url;
                              else toast({ title: "Could not open billing portal", description: d.error ?? "Please try again.", variant: "destructive" });
                            })
                            .catch(() => toast({ title: "Network error", variant: "destructive" }))
                            .finally(() => setChangingPlan(false));
                          return;
                        }
                        // Paid plan — redirect to active gateway
                        const gateway = config.defaultGateway;
                        if (gateway === "stripe") {
                          fetch(`${basePath}/api/stripe/create-checkout`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            credentials: "include", body: JSON.stringify({
                              planId: changePlanId,
                              billingCycle: changePlanCycle,
                              successUrl: `${window.location.origin}${basePath}/checkout/success`,
                              cancelUrl: `${window.location.origin}${basePath}/billing`,
                            }),
                          })
                            .then((r) => r.json() as Promise<{ url?: string; error?: string }>)
                            .then((d) => {
                              if (d.url) window.location.href = d.url;
                              else toast({ title: "Could not start checkout", description: d.error ?? "Please try again.", variant: "destructive" });
                            })
                            .catch(() => toast({ title: "Network error", variant: "destructive" }))
                            .finally(() => setChangingPlan(false));
                          return;
                        }
                        if (gateway === "paypal") {
                          fetch(`${basePath}/api/paypal/create-order`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            credentials: "include", body: JSON.stringify({
                              amount: newPlanPrice,
                              currency: "USD",
                              origin: window.location.origin,
                            }),
                          })
                            .then((r) => r.json() as Promise<{ orderId?: string; approvalUrl?: string; error?: string }>)
                            .then((d) => {
                              if (d.approvalUrl) {
                                localStorage.setItem("paypal_order_id", d.orderId ?? "");
                                localStorage.setItem("paypal_plan_id", String(changePlanId));
                                localStorage.setItem("paypal_billing_cycle", changePlanCycle);
                                window.location.href = d.approvalUrl;
                              } else {
                                toast({ title: "Could not start checkout", description: d.error ?? "No PayPal approval URL.", variant: "destructive" });
                              }
                            })
                            .catch(() => toast({ title: "Network error", variant: "destructive" }))
                            .finally(() => setChangingPlan(false));
                          return;
                        }
                        if (gateway === "razorpay") {
                          // Plan change via Razorpay — not yet supported
                          toast({ title: "Gateway not supported", description: "Razorpay plan changes are not yet supported.", variant: "destructive" });
                          setChangingPlan(false);
                          return;
                        }
                        toast({ title: "No payment gateway configured", description: "Please configure a payment gateway.", variant: "destructive" });
                        setChangingPlan(false);
                      }}
                    >
                      {isCurrent ? "Current" : changingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select"}
                    </Button>
                  </div>
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
          <CustomCreditsSection balance={{ ai: credits.aiCredits ?? 0, image: credits.imageCredits ?? 0, audit: credits.auditCredits ?? 0 }} config={config} />
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
                        const gateway = config.defaultGateway;
                        const res = await fetch(`${basePath}/api/buy-credits`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          credentials: "include", body: JSON.stringify({ packId: pack.id, paymentMethod: gateway, origin: window.location.origin }),
                        });
                        const d = await res.json() as {
                          url?: string; error?: string;
                          orderId?: string; approvalUrl?: string; clientId?: string;
                          amount?: number; currency?: string; keyId?: string;
                          creditAmount?: number;
                        };
                        if (!res.ok) { toast({ title: "Purchase failed", description: d.error ?? "Please try again.", variant: "destructive" }); setBuyingPackId(null); return; }

                        if (gateway === "stripe") {
                          if (d.url) window.location.href = d.url;
                          else { toast({ title: "Purchase failed", description: "No checkout URL.", variant: "destructive" }); setBuyingPackId(null); }
                          return;
                        }

                        if (gateway === "paypal") {
                          if (d.approvalUrl) {
                            localStorage.setItem("paypal_order_id", d.orderId ?? "");
                            localStorage.setItem("paypal_pack_id", String(pack.id));
                            window.location.href = d.approvalUrl;
                          } else {
                            toast({ title: "Purchase failed", description: "No PayPal approval URL.", variant: "destructive" });
                            setBuyingPackId(null);
                          }
                          return;
                        }

                        if (gateway === "razorpay") {
                          if (!d.orderId || !d.keyId) { toast({ title: "Purchase failed", description: "No Razorpay order.", variant: "destructive" }); setBuyingPackId(null); return; }
                          await loadRazorpayScript();
                          const rzp = new (window as Window & { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay!({
                            key: d.keyId,
                            amount: d.amount,
                            currency: d.currency,
                            name: "ListingAuditor",
                            description: pack.label ?? `${pack.quantity} ${pack.creditType} credits`,
                            order_id: d.orderId,
                            handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
                              const verify = await fetch(`${basePath}/api/razorpay/verify-payment`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_payment_id: response.razorpay_payment_id,
                                  razorpay_signature: response.razorpay_signature,
                                  packId: pack.id,
                                }),
                              });
                              const vd = await verify.json() as { success?: boolean; addedCredits?: number; creditType?: string; error?: string };
                              if (vd.success) {
                                toast({ title: "Credit purchase successful", description: `Added ${vd.addedCredits} ${vd.creditType} credits.` });
                                void refetchCreditQueries(queryClient);
                              } else {
                                toast({ title: "Payment verification failed", description: vd.error ?? "Please contact support.", variant: "destructive" });
                              }
                              setBuyingPackId(null);
                            },
                          });
                          rzp.open();
                        }
                      } catch { toast({ title: "Network error", variant: "destructive" }); setBuyingPackId(null); }
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
                <span className="text-xs text-slate-400">{creditTransactions.length} entries</span>
              </div>
              {creditTransactions.length === 0 ? (
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
                    {creditTransactions.map((tx) => {
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
              {Object.keys(creditBreakdown).length === 0 ? (
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
                    {Object.entries(creditBreakdown).map(([feature, data]) => (
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
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Coupon</th>
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
                      <td className="px-5 py-4 text-slate-600 text-xs">
                        {p.couponCode ? (
                          <span className="text-green-600 font-medium">{p.couponCode}{p.discountAmount ? ` –$${p.discountAmount}` : ""}</span>
                        ) : "—"}
                      </td>
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
