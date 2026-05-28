import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, CreditCard, Gift, Zap, Image, BarChart3, ArrowLeft, Tag, Shield, RefreshCw, Search, Globe, Users, FileText, Lock } from "lucide-react";
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
  features: string[];
  isTrial: boolean;
  trialDays: number;
  tag: string | null;
  isHighlighted: boolean;
  ctaText: string | null;
}

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "India", "Brazil", "Mexico", "Japan", "South Korea", "Netherlands", "Spain",
  "Italy", "Singapore", "UAE", "South Africa", "Nigeria", "Pakistan", "Bangladesh",
  "Indonesia", "Philippines", "Vietnam", "Thailand", "Malaysia", "Egypt",
  "Saudi Arabia", "Turkey", "Poland", "Sweden", "Norway", "Denmark", "Switzerland",
  "Belgium", "Argentina", "Colombia", "Chile", "Peru", "New Zealand", "Other",
];

const FALLBACK_PLANS: Plan[] = [
  { id: 0, name: "Starter", description: "Perfect for solo sellers", priceMonthly: 29, priceYearly: 23, aiCredits: 100, imageCredits: 20, auditCredits: 10, teamMembers: 1, features: ["10 listing audits/mo", "100 AI credits", "20 image credits", "Competitor comparison"], isTrial: true, trialDays: 14, tag: null, isHighlighted: false, ctaText: null },
  { id: 0, name: "Growth", description: "For growing brands", priceMonthly: 79, priceYearly: 63, aiCredits: 500, imageCredits: 100, auditCredits: 50, teamMembers: 3, features: ["50 listing audits/mo", "500 AI credits", "100 image credits", "3 team members"], isTrial: true, trialDays: 14, tag: "Most Popular", isHighlighted: true, ctaText: null },
  { id: 0, name: "Pro", description: "For agencies & power sellers", priceMonthly: 149, priceYearly: 119, aiCredits: 2000, imageCredits: 400, auditCredits: 999, teamMembers: 10, features: ["Unlimited audits", "2,000 AI credits", "400 image credits", "API access"], isTrial: true, trialDays: 14, tag: "Best Value", isHighlighted: false, ctaText: null },
  { id: 0, name: "Enterprise", description: "Custom solution for large agencies", priceMonthly: 0, priceYearly: 0, aiCredits: 999999, imageCredits: 999999, auditCredits: 999, teamMembers: 999, features: ["Unlimited everything", "Custom credits", "Dedicated account manager", "Full API access"], isTrial: false, trialDays: 0, tag: null, isHighlighted: false, ctaText: null },
];

function StepIndicator({ step, total }: { step: number; total: number }) {
  const labels = ["Your Profile", "Choose Plan", "Payment"];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${i < step ? "bg-orange-500 text-white" : i === step ? "bg-orange-100 text-orange-600 ring-2 ring-orange-400" : "bg-slate-100 text-slate-400"}`}>
            {i < step ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          <div className="flex flex-col items-center ml-2 mr-4">
            <span className={`text-xs font-medium ${i === step ? "text-orange-600" : i < step ? "text-slate-600" : "text-slate-400"}`}>{labels[i]}</span>
          </div>
          {i < total - 1 && <div className={`w-12 h-0.5 mx-2 ${i < step ? "bg-orange-400" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
  const [useTrial, setUseTrial] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  useEffect(() => {
    if (isLoaded && user) {
      setProfile((p) => ({ ...p, fullName: user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() }));
    }
  }, [isLoaded, user]);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const displayPlans = plans.length > 0 ? plans : FALLBACK_PLANS;

  // Auto-select first plan and sync useTrial to plan's trial eligibility
  useEffect(() => {
    if (displayPlans.length > 0 && selectedPlanId === null) {
      const highlighted = displayPlans.find((p) => p.isHighlighted) ?? displayPlans[0];
      if (highlighted) {
        setSelectedPlanId(highlighted.id);
        setUseTrial(!!(highlighted.isTrial && (highlighted.trialDays ?? 0) > 0));
      }
    }
  }, [displayPlans, selectedPlanId]);

  // Keep useTrial in sync when user changes plans
  useEffect(() => {
    const plan = displayPlans.find((p) => p.id === selectedPlanId);
    if (plan) {
      setUseTrial(!!(plan.isTrial && (plan.trialDays ?? 0) > 0));
    }
  }, [selectedPlanId, displayPlans]);

  const selectedPlan = displayPlans.find((p) => p.id === selectedPlanId) ?? displayPlans[0];

  const validateCouponMutation = useMutation({
    mutationFn: (code: string) =>
      fetch(`${basePath}/api/coupon/validate`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (data) => { setCouponResult(data); setCouponError(""); },
    onError: (e: Error) => { setCouponError(e.message); setCouponResult(null); },
  });

  const onboardMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/onboarding`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { toast({ title: "Welcome aboard!", description: "Your free trial is active." }); setLocation("/dashboard"); },
    onError: (e: Error) => { toast({ title: "Setup failed", description: e.message, variant: "destructive" }); },
  });

  const checkoutMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/stripe/create-checkout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (data: { url: string }) => { window.location.href = data.url; },
    onError: (e: Error) => { toast({ title: "Checkout failed", description: e.message, variant: "destructive" }); },
  });

  const freePlanMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/onboarding`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { toast({ title: "Welcome aboard!", description: "Your free plan is active." }); setLocation("/dashboard"); },
    onError: (e: Error) => { toast({ title: "Setup failed", description: e.message, variant: "destructive" }); },
  });

  if (!isLoaded) return null;
  if (!user) { setLocation("/sign-in"); return null; }

  const price = yearly ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly;
  const discount = couponResult ? (couponResult.discountPercent ? Math.round((price ?? 0) * couponResult.discountPercent / 100) : (couponResult.discountAmount ?? 0)) : 0;
  const finalPrice = Math.max(0, (price ?? 0) - discount);

  function handleSubmit() {
    if (!selectedPlan) return;
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
    const planPrice = yearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly;
    if (planPrice === 0) {
      // Free plan — activate instantly without payment
      freePlanMutation.mutate({ ...common, useTrial: false });
    } else if (useTrial) {
      onboardMutation.mutate({ ...common, useTrial: true });
    } else {
      checkoutMutation.mutate({
        ...common,
        successUrl: `${window.location.origin}${basePath}/checkout/success`,
        cancelUrl: `${window.location.origin}${basePath}/onboarding`,
      });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b bg-white/80 backdrop-blur flex items-center px-8">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Search className="w-5 h-5 text-orange-500" />
          <span>Listing<span className="text-orange-500">Auditor</span></span>
        </div>
        <div className="ml-auto text-sm text-slate-400">Signed in as {user.primaryEmailAddress?.emailAddress}</div>
      </div>

      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900">Set up your account</h1>
            <p className="text-slate-500 mt-2">Just 3 quick steps to get started</p>
          </div>
          <StepIndicator step={step} total={3} />

          {/* Step 0 — Profile */}
          {step === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
              <h2 className="text-xl font-bold text-slate-900">Tell us about yourself</h2>

              <div className="grid grid-cols-2 gap-4">
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
                  <Input className="mt-1 bg-slate-50 text-slate-400" value={user.primaryEmailAddress?.emailAddress ?? ""} disabled />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input className="mt-1" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" type="tel" />
                </div>
                <div className="col-span-2">
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
                <div className="grid grid-cols-2 gap-4">
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

              <div className="flex justify-end pt-2">
                <Button
                  className="bg-orange-500 hover:bg-orange-600 px-8"
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
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Choose your plan</h2>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
                    <button onClick={() => setYearly(false)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Monthly</button>
                    <button onClick={() => setYearly(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                      Yearly <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">-20%</span>
                    </button>
                  </div>
                </div>

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
                        <span className="text-slate-400 text-sm mb-0.5">/mo</span>
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
                  <div className="flex gap-2 mt-1.5">
                    <Input className="max-w-xs font-mono uppercase" placeholder="LAUNCH20" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(""); }} />
                    <Button variant="outline" onClick={() => validateCouponMutation.mutate(couponCode)} disabled={!couponCode || validateCouponMutation.isPending}>
                      {validateCouponMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponResult && <p className="text-green-600 text-sm mt-1.5 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{couponResult.description}</p>}
                  {couponError && <p className="text-red-500 text-sm mt-1.5">{couponError}</p>}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 px-8" onClick={() => setStep(2)} disabled={!selectedPlanId}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Payment */}
          {step === 2 && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-5">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-5">Complete your setup</h2>

                  {/* Trial or Pay toggle — only when plan is not free */}
                  {selectedPlan && (yearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly) > 0 && selectedPlan?.isTrial && (selectedPlan.trialDays ?? 0) > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <button
                        onClick={() => setUseTrial(true)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${useTrial ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Gift className="w-4 h-4 text-green-500" />
                          <span className="font-semibold text-sm text-slate-900">Start Free Trial</span>
                          {useTrial && <span className="ml-auto w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>}
                        </div>
                        <p className="text-xs text-slate-500">{selectedPlan.trialDays} days free · No credit card required</p>
                      </button>
                      <button
                        onClick={() => setUseTrial(false)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${!useTrial ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-sm text-slate-900">Pay Now</span>
                          {!useTrial && <span className="ml-auto w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>}
                        </div>
                        <p className="text-xs text-slate-500">Start immediately · Secure Stripe checkout</p>
                      </button>
                    </div>
                  )}

                  {/* Free plan info card — when price is $0 */}
                  {selectedPlan && (yearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly) === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                      <Gift className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">Free plan selected</p>
                      <p className="text-sm text-green-600 mt-1">{selectedPlan.name} — no payment required, instant activation</p>
                      <p className="text-xs text-green-500 mt-2">You can upgrade to a paid plan anytime from your billing page</p>
                    </div>
                  )}

                  {/* Trial info card — only when plan actually supports trial and is paid */}
                  {useTrial && selectedPlan && (yearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly) > 0 && selectedPlan?.isTrial && (selectedPlan.trialDays ?? 0) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                      <Gift className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">You're starting with a free trial</p>
                      <p className="text-sm text-green-600 mt-1">{selectedPlan.trialDays} days free on the {selectedPlan.name} plan — cancel anytime</p>
                      <p className="text-xs text-green-500 mt-2">No credit card required to start your trial</p>
                    </div>
                  )}

                  {/* Paid — Stripe redirect */}
                  {selectedPlan && (yearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly) > 0 && (!selectedPlan?.isTrial || !useTrial) && (
                    <div className="space-y-4">
                      {/* Price breakdown */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{selectedPlan?.name} Plan</span>
                          <span className="font-semibold text-slate-900">${price}/mo</span>
                        </div>
                        {yearly && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Billed annually</span>
                            <span className="text-green-600 font-medium">–20%</span>
                          </div>
                        )}
                        {couponResult && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Coupon ({couponCode})</span>
                            <span className="text-green-600 font-medium">–${discount}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-sm">Total today</span>
                          <span className="font-bold text-orange-600">${finalPrice}/mo</span>
                        </div>
                      </div>

                      {/* Security notice */}
                      <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl border border-slate-100 px-3.5 py-3">
                        <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 leading-relaxed">
                          You'll be securely redirected to <strong className="text-slate-600">Stripe</strong> to enter your payment details. Your card information is never stored on our servers.
                        </p>
                      </div>

                      {/* Auto-renewal */}
                      <div className="flex items-center justify-between border-t pt-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Auto-renewal</p>
                          <p className="text-xs text-slate-500">Automatically renew at end of billing period</p>
                        </div>
                        <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                        <Lock className="w-3 h-3" />
                        <span>256-bit SSL · PCI-DSS compliant · Powered by Stripe</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 px-8"
                    onClick={handleSubmit}
                    disabled={onboardMutation.isPending || checkoutMutation.isPending || freePlanMutation.isPending}
                  >
                    {(onboardMutation.isPending || checkoutMutation.isPending || freePlanMutation.isPending)
                      ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{(yearly ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly) === 0 ? "Activating..." : useTrial ? "Setting up..." : "Redirecting to Stripe..."}</>
                      : (yearly ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly) === 0
                        ? "Continue with Free Plan →"
                        : useTrial && selectedPlan?.isTrial
                          ? "Start Free Trial →"
                          : "Pay Securely with Stripe →"}
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
                      <span className="font-medium">${price}/mo</span>
                    </div>
                    {yearly && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Billed yearly</span>
                        <span className="text-green-600 font-medium">-20%</span>
                      </div>
                    )}
                    {couponResult && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Coupon ({couponCode})</span>
                        <span className="text-green-600 font-medium">-${discount}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-orange-600">{(yearly ? selectedPlan?.priceYearly : selectedPlan?.priceMonthly) === 0 ? "FREE" : useTrial && selectedPlan?.isTrial ? "FREE" : `$${finalPrice}/mo`}</span>
                    </div>
                    {useTrial && selectedPlan?.isTrial && (selectedPlan.trialDays ?? 0) > 0 && (
                      <p className="text-xs text-slate-400 text-center">Then ${price}/mo after trial</p>
                    )}
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
