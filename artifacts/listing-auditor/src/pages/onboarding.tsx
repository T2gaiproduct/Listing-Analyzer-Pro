import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, CreditCard, Gift, Zap, Image, BarChart3, ArrowLeft, Tag, Shield, RefreshCw, Search, Globe, Users, FileText, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";

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
  features: string[];
  isTrial: boolean;
  trialDays: number;
  tag: string | null;
  isHighlighted: boolean;
  ctaText: string | null;
}

interface PaymentConfig {
  defaultGateway: "stripe" | "razorpay" | "paypal";
  currency: string;
  stripe: { enabled: boolean; publishableKey: string; mode: string };
  razorpay: { enabled: boolean; keyId: string };
  paypal: { enabled: boolean; clientId: string; mode: string };
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  const labels = ["Your Profile", "Choose Plan", "Payment"];
  return (
    <>
      {/* Mobile: compact progress */}
      <div className="mb-8 sm:hidden px-1">
        <p className="text-center text-sm font-medium text-slate-500 mb-3">
          Step {step + 1} of {total}
          <span className="text-slate-300 mx-2">·</span>
          <span className="text-orange-600">{labels[step]}</span>
        </p>
        <div className="flex gap-2 justify-center max-w-xs mx-auto">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-orange-500" : "bg-slate-200"}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-center justify-center gap-0 mb-10">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${i < step ? "bg-orange-500 text-white" : i === step ? "bg-orange-100 text-orange-600 ring-2 ring-orange-400" : "bg-slate-100 text-slate-400"}`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <div className="flex flex-col items-center ml-2 mr-4">
              <span className={`text-xs font-medium whitespace-nowrap ${i === step ? "text-orange-600" : i < step ? "text-slate-600" : "text-slate-400"}`}>{labels[i]}</span>
            </div>
            {i < total - 1 && <div className={`w-12 h-0.5 mx-2 ${i < step ? "bg-orange-400" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Onboarding() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [yearly, setYearly] = useState(false);

  const [profile, setProfile] = useState({
    fullName: "", companyName: "", phone: "", country: "",
    gstNumber: "", websiteUrl: "", teamSize: "",
  });
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{ discountPercent?: number; discountAmount?: number; description?: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);

  useEffect(() => {
    if (isLoaded && user) {
      setProfile((p) => ({ ...p, fullName: user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() }));
    }
  }, [isLoaded, user]);

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["payment-config"],
    queryFn: () => fetch(`${basePath}/api/payment-config`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: existingProfile } = useQuery<{ profile?: { fullName?: string | null; companyName?: string | null; phone?: string | null; country?: string | null; gstNumber?: string | null; websiteUrl?: string | null; teamSize?: number | null; onboardingCompleted?: boolean } | null }>({
    queryKey: ["user-profile"],
    queryFn: () => fetch(`${basePath}/api/profile`, { credentials: "include" }).then((r) => r.json()),
    enabled: isLoaded && !!user,
  });

  const displayPlans = Array.isArray(plans) ? plans : [];

  // Pre-fill profile from existing data for returning customers
  useEffect(() => {
    if (existingProfile?.profile) {
      const p = existingProfile.profile;
      setProfile((prev) => ({
        fullName: prev.fullName || p.fullName || "",
        companyName: prev.companyName || p.companyName || "",
        phone: prev.phone || p.phone || "",
        country: prev.country || p.country || "",
        gstNumber: prev.gstNumber || p.gstNumber || "",
        websiteUrl: prev.websiteUrl || p.websiteUrl || "",
        teamSize: prev.teamSize || (p.teamSize ? String(p.teamSize) : ""),
      }));
      // If already completed onboarding, skip to plan selection
      if (p.onboardingCompleted) {
        setStep(1);
      }
    }
  }, [existingProfile]);

  // Auto-select first plan
  useEffect(() => {
    if (displayPlans.length > 0 && selectedPlanId === null) {
      const highlighted = displayPlans.find((p) => p.isHighlighted) ?? displayPlans[0];
      if (highlighted) {
        setSelectedPlanId(highlighted.id);
      }
    }
  }, [displayPlans, selectedPlanId]);

  const selectedPlan = displayPlans.find((p) => p.id === selectedPlanId) ?? displayPlans[0];

  const validateCouponMutation = useMutation({
    mutationFn: (code: string) =>
      fetch(`${basePath}/api/coupon/validate`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (data) => { setCouponResult(data); setCouponError(""); },
    onError: (e: Error) => { setCouponError(e.message); setCouponResult(null); },
  });

  const checkoutMutation = useMutation({
    mutationFn: (body: { gateway: string; [key: string]: unknown }) => {
      const endpoint =
        body.gateway === "stripe"
          ? `${basePath}/api/stripe/create-checkout`
          : body.gateway === "razorpay"
            ? `${basePath}/api/razorpay/create-order`
            : body.gateway === "paypal"
              ? `${basePath}/api/paypal/create-order`
              : `${basePath}/api/stripe/create-checkout`;
      return fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); });
    },
    onSuccess: (data: { url?: string; approvalUrl?: string; orderId?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.approvalUrl) {
        localStorage.setItem("paypal_order_id", data.orderId ?? "");
        localStorage.setItem("paypal_plan_id", String(selectedPlan.id));
        localStorage.setItem("paypal_billing_cycle", yearly ? "yearly" : "monthly");
        window.location.href = data.approvalUrl;
      }
    },
    onError: (e: Error) => { toast({ title: "Checkout failed", description: e.message, variant: "destructive" }); },
  });

  const freePlanMutation = useMutation({
    mutationFn: () => {
      const body = {
        fullName: profile.fullName,
        companyName: profile.companyName,
        phone: profile.phone,
        country: profile.country,
        gstNumber: profile.gstNumber || undefined,
        websiteUrl: profile.websiteUrl || undefined,
        teamSize: profile.teamSize ? Number(profile.teamSize) : undefined,
        planId: selectedPlan!.id,
        billingCycle: yearly ? "yearly" : "monthly",
        autoRenew,
        useTrial: false,
        couponCode: couponCode || undefined,
      };
      return fetch(`${basePath}/api/onboarding`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-usage"] });
      setLocation("/dashboard");
    },
    onError: (e: Error) => { toast({ title: "Activation failed", description: e.message, variant: "destructive" }); },
  });

  if (!isLoaded) return null;
  if (!user) { setLocation("/sign-in"); return null; }

  const price = yearly ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly;
  const discount = couponResult ? (couponResult.discountPercent ? Math.round((price ?? 0) * couponResult.discountPercent / 100) : (couponResult.discountAmount ?? 0)) : 0;
  const finalPrice = Math.max(0, (price ?? 0) - discount);

  const gateway = paymentConfig?.defaultGateway ?? "stripe";
  const gatewayName = gateway.charAt(0).toUpperCase() + gateway.slice(1);
  const gatewayLabels: Record<string, string> = { stripe: "Stripe", razorpay: "Razorpay", paypal: "PayPal" };
  const gatewayDisplayName = gatewayLabels[gateway] ?? gatewayName;

  function handleSubmit() {
    if (!selectedPlan) return;

    // Free plan — activate directly without payment gateway
    if (finalPrice === 0) {
      freePlanMutation.mutate();
      return;
    }

    const common = {
      fullName: profile.fullName,
      companyName: profile.companyName,
      phone: profile.phone,
      country: profile.country,
      gstNumber: profile.gstNumber || undefined,
      websiteUrl: profile.websiteUrl || undefined,
      teamSize: profile.teamSize ? Number(profile.teamSize) : undefined,
      planId: selectedPlan.id,
      billingCycle: yearly ? "yearly" : "monthly",
      autoRenew,
      couponCode: couponCode || undefined,
    };

    const finalAmount = Math.max(0, finalPrice);

    if (gateway === "stripe") {
      checkoutMutation.mutate({
        gateway: "stripe",
        ...common,
        successUrl: `${window.location.origin}${basePath}/checkout/success`,
        cancelUrl: `${window.location.origin}${basePath}/onboarding`,
      });
    } else if (gateway === "razorpay") {
      checkoutMutation.mutate({
        gateway: "razorpay",
        ...common,
        amount: finalAmount,
        currency: paymentConfig?.currency ?? "USD",
      });
    } else if (gateway === "paypal") {
      checkoutMutation.mutate({
        gateway: "paypal",
        ...common,
        amount: finalAmount,
        currency: paymentConfig?.currency ?? "USD",
        origin: window.location.origin,
      });
    } else {
      checkoutMutation.mutate({
        gateway: "stripe",
        ...common,
        successUrl: `${window.location.origin}${basePath}/checkout/success`,
        cancelUrl: `${window.location.origin}${basePath}/onboarding`,
      });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="min-h-14 sm:min-h-16 border-b bg-white/80 backdrop-blur flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 px-4 sm:px-8 py-3 sm:py-0">
        <div className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight min-w-0">
          <Search className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <span className="truncate">Listing<span className="text-orange-500">Auditor</span></span>
        </div>
        <div className="sm:ml-auto text-xs sm:text-sm text-slate-400 min-w-0 max-w-full">
          <span className="hidden sm:inline">Signed in as </span>
          <span className="sm:text-slate-400 text-slate-500 font-medium truncate block sm:inline">
            {user.primaryEmailAddress?.emailAddress}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center py-6 sm:py-12 px-4 sm:px-6">
        <div className="w-full max-w-3xl min-w-0">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Set up your account</h1>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">Just 3 quick steps to get started</p>
          </div>
          <StepIndicator step={step} total={3} />

          {/* Step 0 — Profile */}
          {step === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8 space-y-5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Tell us about yourself</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input className="mt-1" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} placeholder="Jane Smith" />
                </div>
                <div>
                  <Label>Company / Brand Name *</Label>
                  <Input className="mt-1" value={profile.companyName} onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))} placeholder="Acme Brands LLC" />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input className="mt-1 bg-slate-50 text-slate-400 truncate" value={user.primaryEmailAddress?.emailAddress ?? ""} disabled />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input className="mt-1" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" type="tel" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Country *</Label>
                  <select
                    className="mt-1 w-full h-9 border border-input rounded-md bg-background px-3 text-sm"
                    value={profile.country}
                    onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                  >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Optional fields */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Optional Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs flex items-center gap-1.5"><FileText className="w-3 h-3 text-slate-400" />GST / Tax Number</Label>
                    <Input className="mt-1 text-sm" value={profile.gstNumber} onChange={(e) => setProfile((p) => ({ ...p, gstNumber: e.target.value }))} placeholder="GST1234567890" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1.5"><Globe className="w-3 h-3 text-slate-400" />Website URL</Label>
                    <Input className="mt-1 text-sm" value={profile.websiteUrl} onChange={(e) => setProfile((p) => ({ ...p, websiteUrl: e.target.value }))} placeholder="https://yourstore.com" type="url" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1.5"><Users className="w-3 h-3 text-slate-400" />Team Size</Label>
                    <select
                      className="mt-1 w-full h-9 border border-input rounded-md bg-background px-3 text-sm"
                      value={profile.teamSize}
                      onChange={(e) => setProfile((p) => ({ ...p, teamSize: e.target.value }))}
                    >
                      <option value="">Select team size</option>
                      <option value="1">Just me</option>
                      <option value="2">2–5 people</option>
                      <option value="6">6–10 people</option>
                      <option value="11">11–25 people</option>
                      <option value="26">26–50 people</option>
                      <option value="51">50+ people</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-stretch sm:justify-end pt-2">
                <Button
                  className="bg-orange-500 hover:bg-orange-600 px-8 w-full sm:w-auto"
                  onClick={() => setStep(1)}
                  disabled={!profile.fullName || !profile.companyName || !profile.country}
                >
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1 — Plan selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Choose your plan</h2>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1 self-start sm:self-auto">
                    <button onClick={() => setYearly(false)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Monthly</button>
                    <button onClick={() => setYearly(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                      Yearly <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">-20%</span>
                    </button>
                  </div>
                </div>

                {plansLoading && displayPlans.length === 0 && (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading plans…
                  </div>
                )}
                {!plansLoading && displayPlans.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    No plans are available right now. Please try again shortly or contact support.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {displayPlans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${selectedPlanId === plan.id ? "border-orange-400 bg-orange-50/50 shadow-md" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      {plan.tag && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">{plan.tag}</span>
                        </div>
                      )}
                      {selectedPlanId === plan.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <p className="font-bold text-slate-900 mb-1">{plan.name}</p>
                      <p className="text-xs text-slate-500 mb-3">{plan.description}</p>
                      <div className="flex items-end gap-1 mb-3">
                        <span className="text-3xl font-extrabold text-slate-900">${yearly ? plan.priceYearly : plan.priceMonthly}</span>
                        <span className="text-slate-400 text-sm mb-0.5">{yearly ? "/year" : "/mo"}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-blue-700"><Zap className="w-3 h-3" />{plan.aiCredits} AI credits</div>
                        <div className="flex items-center gap-1.5 text-purple-700"><Image className="w-3 h-3" />{plan.imageCredits} image credits</div>
                        <div className="flex items-center gap-1.5 text-orange-700"><BarChart3 className="w-3 h-3" />{plan.auditCredits === 999 ? "Unlimited" : plan.auditCredits} audits</div>
                      </div>
                      {plan.isTrial && plan.trialDays > 0 && (
                        <div className="mt-3 bg-green-50 text-green-700 text-xs rounded-lg px-2.5 py-1.5 font-medium">
                          ✓ {plan.trialDays}-day free trial included
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Coupon code */}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <Label className="text-sm flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-orange-500" />Have a coupon code?</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
                    <Input className="sm:max-w-xs font-mono uppercase" placeholder="LAUNCH20" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(""); }} />
                    <Button variant="outline" className="sm:flex-shrink-0" onClick={() => validateCouponMutation.mutate(couponCode)} disabled={!couponCode || validateCouponMutation.isPending}>
                      {validateCouponMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponResult && <p className="text-green-600 text-sm mt-1.5 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{couponResult.description}</p>}
                  {couponError && <p className="text-red-500 text-sm mt-1.5">{couponError}</p>}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 px-8 w-full sm:w-auto" onClick={() => setStep(2)} disabled={!selectedPlanId}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Payment */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 space-y-5">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-5">Complete your setup</h2>

                  {/* Free plan info */}
                  {finalPrice === 0 ? (
                    <div className="flex items-start gap-2.5 bg-green-50 rounded-xl border border-green-100 px-3.5 py-3 mb-5">
                      <Zap className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700 leading-relaxed">
                        You're about to start the <strong className="text-green-800">{selectedPlan?.name}</strong> plan at no cost. No payment details required.
                      </p>
                    </div>
                  ) : (
                    /* Payment info — shows active gateway */
                    <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl border border-slate-100 px-3.5 py-3 mb-5">
                      <Wallet className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        You'll be securely redirected to <strong className="text-slate-600">{gatewayDisplayName}</strong> to enter your payment details. Your card information is never stored on our servers.
                      </p>
                    </div>
                  )}

                  {/* Payment / Free plan breakdown */}
                  {selectedPlan && (
                    <div className="space-y-4">
                      {/* Price breakdown */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{selectedPlan?.name} Plan</span>
                          <span className="font-semibold text-slate-900">
                            {finalPrice === 0 ? "Free" : <>${price}{yearly ? "/year" : "/mo"}</>}
                          </span>
                        </div>
                        {yearly && finalPrice > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Billed annually</span>
                            <span className="text-green-600 font-medium">–20%</span>
                          </div>
                        )}
                        {couponResult && finalPrice > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Coupon ({couponCode})</span>
                            <span className="text-green-600 font-medium">–${discount}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-sm">Total today</span>
                          <span className={finalPrice === 0 ? "font-bold text-green-600" : "font-bold text-orange-600"}>
                            {finalPrice === 0 ? "Free" : <>${finalPrice}{yearly ? "/year" : "/mo"}</>}
                          </span>
                        </div>
                      </div>

                      {/* Auto-renewal — only for paid */}
                      {finalPrice > 0 && (
                        <div className="flex items-center justify-between border-t pt-4">
                          <div>
                            <p className="text-sm font-medium text-slate-800">Auto-renewal</p>
                            <p className="text-xs text-slate-500">Automatically renew at end of billing period</p>
                          </div>
                          <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
                        </div>
                      )}

                      {finalPrice > 0 && (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                          <Lock className="w-3 h-3" />
                          <span>256-bit SSL · PCI-DSS compliant · Powered by {gatewayDisplayName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                  <Button
                    className={`px-8 w-full sm:w-auto ${finalPrice === 0 ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}
                    onClick={handleSubmit}
                    disabled={checkoutMutation.isPending || freePlanMutation.isPending}
                  >
                    {freePlanMutation.isPending
                      ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Activating...</>
                      : checkoutMutation.isPending
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Redirecting to {gatewayDisplayName}...</>
                        : finalPrice === 0
                          ? "Start Free Plan →"
                          : `Pay Securely with ${gatewayDisplayName} →`}
                  </Button>
                </div>
              </div>

              {/* Order summary */}
              <div className="col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sticky top-6">
                  <p className="font-bold text-slate-900 mb-4">Order Summary</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{selectedPlan?.name} Plan</span>
                      <span className="font-medium">
                        {finalPrice === 0 ? "Free" : <>${price}{yearly ? "/year" : "/mo"}</>}
                      </span>
                    </div>
                    {yearly && finalPrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Billed yearly</span>
                        <span className="text-green-600 font-medium">-20%</span>
                      </div>
                    )}
                    {couponResult && finalPrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Coupon ({couponCode})</span>
                        <span className="text-green-600 font-medium">-${discount}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between font-bold">
                      <span>Total</span>
                      <span className={finalPrice === 0 ? "text-green-600" : "text-orange-600"}>
                        {finalPrice === 0 ? "Free" : <>${finalPrice}{yearly ? "/year" : "/mo"}</>}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t space-y-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Includes:</p>
                    <div className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-blue-500" />{selectedPlan?.aiCredits} AI credits/mo</div>
                    <div className="flex items-center gap-1.5"><Image className="w-3 h-3 text-purple-500" />{selectedPlan?.imageCredits} image credits/mo</div>
                    <div className="flex items-center gap-1.5"><BarChart3 className="w-3 h-3 text-orange-500" />{selectedPlan?.auditCredits === 999 ? "Unlimited" : selectedPlan?.auditCredits} audit credits/mo</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
