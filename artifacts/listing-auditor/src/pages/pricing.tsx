import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Zap, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { PageSeo } from "@/components/page-seo";
import { cn } from "@/lib/utils";
import { computePlanCreditsFromAllocations } from "@/lib/plan-credits";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DbPlan {
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
  tag: string | null;
  isHighlighted: boolean;
  ctaText: string | null;
  isTrial: boolean;
  trialDays: number;
}

interface ActivityBadge {
  label: string;
  value: string;
  color: string;
}

interface DisplayPlan {
  name: string;
  tag: string | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  description: string;
  aiCredits: number | null;
  imageCredits: number | null;
  auditCredits: number | null;
  teamMembers: number | null;
  creditAllocations: Record<string, number> | null;
  features: { text: string; included: boolean }[];
  cta: string;
  ctaVariant: "default" | "outline";
  isHighlighted: boolean;
  isEnterprise?: boolean;
}

const FALLBACK_PLANS: DisplayPlan[] = [
  {
    name: "Free Plan (1 Product)", tag: null, monthlyPrice: 0, yearlyPrice: 0,
    description: "Perfect for solo sellers getting started with AI optimization.",
    aiCredits: 15, imageCredits: 10, auditCredits: 10, teamMembers: 1,
    creditAllocations: { audit: 10, content: 15, images: 10, ebc: 5, competitors: 5, teamMembers: 1 },
    features: [
      { text: "1 listing audit/mo", included: true }, { text: "10 AI content credits", included: true },
      { text: "10 image generation credits", included: true }, { text: "Competitor comparison", included: true },
      { text: "Score breakdown & suggestions", included: true }, { text: "Email support", included: true },
      { text: "Team members", included: false }, { text: "API access", included: false },
    ],
    cta: "Get Started", ctaVariant: "outline", isHighlighted: false,
  },
  {
    name: "Growth (5 Products)", tag: "Most Popular", monthlyPrice: 49, yearlyPrice: 40,
    description: "For growing brands that need more power and faster results.",
    aiCredits: 75, imageCredits: 50, auditCredits: 50, teamMembers: 3,
    creditAllocations: { audit: 50, content: 75, images: 50, ebc: 25, competitors: 25, teamMembers: 3 },
    features: [
      { text: "50 listing audits/mo", included: true }, { text: "75 AI content credits", included: true },
      { text: "50 image generation credits", included: true }, { text: "25 A+ / EBC content pieces", included: true },
      { text: "25 competitor analyses", included: true }, { text: "3 team members", included: true },
      { text: "Priority email support", included: true }, { text: "API access", included: false },
    ],
    cta: "Start 14-Day Trial", ctaVariant: "default", isHighlighted: true,
  },
  {
    name: "Pro (10 Products)", tag: "Best Value", monthlyPrice: 99, yearlyPrice: 80,
    description: "For agencies and power sellers with high-volume needs.",
    aiCredits: 150, imageCredits: 100, auditCredits: 100, teamMembers: 5,
    creditAllocations: { audit: 100, content: 150, images: 100, ebc: 50, competitors: 50, teamMembers: 5 },
    features: [
      { text: "100 listing audits/mo", included: true }, { text: "150 AI content credits", included: true },
      { text: "100 image generation credits", included: true }, { text: "50 A+ / EBC content pieces", included: true },
      { text: "50 competitor analyses", included: true }, { text: "5 team members", included: true },
      { text: "Dedicated support", included: true }, { text: "API access", included: true },
    ],
    cta: "Start 14-Day Trial", ctaVariant: "outline", isHighlighted: true,
  },
  {
    name: "Enterprise (25 Products)", tag: null, monthlyPrice: 249, yearlyPrice: 200,
    description: "Custom solution for large agencies and enterprise brands.",
    aiCredits: 375, imageCredits: 250, auditCredits: 250, teamMembers: 10,
    creditAllocations: { audit: 250, content: 375, images: 250, ebc: 125, competitors: 125, teamMembers: 10 },
    features: [
      { text: "250 listing audits/mo", included: true }, { text: "375 AI content credits", included: true },
      { text: "250 image generation credits", included: true }, { text: "125 A+ / EBC content pieces", included: true },
      { text: "125 competitor analyses", included: true }, { text: "10 team members", included: true },
      { text: "Dedicated account manager", included: true }, { text: "Full API access", included: true },
      { text: "White-label reports", included: true },
    ],
    cta: "Get Started", ctaVariant: "outline", isHighlighted: false,
  },
];

function dbPlanToDisplay(p: DbPlan): DisplayPlan {
  const isHighlighted = p.isHighlighted || p.tag === "Most Popular";
  const a = p.creditAllocations ?? {};
  const includedFeatures: { text: string; included: boolean }[] = p.features.length > 0
    ? p.features.map((f) => ({ text: f, included: true }))
    : [
        { text: `${a.audit ?? p.auditCredits ?? 0} listing audits/mo`, included: true },
        { text: `${a.content ?? 0} AI content credits`, included: true },
        { text: `${a.images ?? p.imageCredits ?? 0} image generation credits`, included: true },
        { text: `${a.ebc ?? 0} A+ / EBC content credits`, included: true },
        { text: `${a.competitors ?? 0} competitor analysis credits`, included: true },
        { text: `${p.teamMembers} team members`, included: true },
        { text: "Score breakdown & suggestions", included: true },
      ];
  const excludedFeatures: { text: string; included: boolean }[] = (p.excludedFeatures ?? []).map((f) => ({ text: f, included: false }));
  return {
    name: p.name,
    tag: p.tag,
    monthlyPrice: p.priceMonthly,
    yearlyPrice: p.priceYearly,
    description: p.description ?? "",
    aiCredits: p.aiCredits,
    imageCredits: p.imageCredits,
    auditCredits: p.auditCredits === 999 ? null : p.auditCredits,
    teamMembers: p.teamMembers,
    creditAllocations: p.creditAllocations,
    features: [...includedFeatures, ...excludedFeatures],
    cta: p.ctaText ?? (p.isTrial && p.trialDays > 0
      ? `Start ${p.trialDays}-Day Trial`
      : (p.priceMonthly === null ? "Contact Sales" : "Get Started")),
    ctaVariant: isHighlighted ? "default" : "outline",
    isHighlighted,
  };
}

const addOns = [
  { name: "Audit Credits", price: "$1.00", per: "10 credits" },
  { name: "Text Content Credits", price: "$1.50", per: "15 credits" },
  { name: "Image Credits", price: "$1.00", per: "10 credits" },
  { name: "A+ / EBC Content", price: "$0.50", per: "5 pieces" },
  { name: "Competitor Analysis", price: "$0.50", per: "5 analyses" },
];

const defaultFaqs = [
  { q: "What are credits?", a: "Credits are the currency for AI operations. AI content credits power title/bullet rewrites and keyword suggestions. Image credits generate professional product photos. Audit credits run full listing analyses." },
  { q: "Can I change plans anytime?", a: "Yes — upgrade or downgrade anytime from your billing settings. Upgrades take effect immediately; downgrades apply at the next billing cycle." },
  { q: "Is there a free trial?", a: "Starter, Growth, and Pro plans include a 14-day free trial. No credit card required to start. Enterprise plans are custom and do not include a trial." },
  { q: "Do unused credits roll over?", a: "Credits reset monthly. Any unused credits from the previous cycle do not roll over, but you can purchase add-on credits at any time." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for Enterprise plans." },
  { q: "Can I get a refund?", a: "We offer a money-back guarantee on all plans. Enterprise plans are handled case-by-case — contact our sales team." },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  // Scroll to hash on load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      }
    }
  }, []);

  const { data: dbPlans = [] } = useQuery<DbPlan[]>({
    queryKey: ["public-plans"],
    queryFn: () => fetch(`${basePath}/api/plans`).then((r) => r.json()),
  });

  const { data: dbFaqs = [] } = useQuery<{ question: string; answer: string }[]>({
    queryKey: ["public-faqs"],
    queryFn: () => fetch(`${basePath}/api/faqs`).then((r) => r.json()).catch(() => []),
  });
  const { data: creditRules = [] } = useQuery<{ featureType: string; creditsRequired: number; isActive?: boolean }[]>({
    queryKey: ["credit-rules"],
    queryFn: () => fetch(`${basePath}/api/credit-rules`).then((r) => r.json()),
  });
  const faqs = dbFaqs.length > 0 ? dbFaqs.map((f) => ({ q: f.question, a: f.answer })) : defaultFaqs;

  const plans: DisplayPlan[] = dbPlans.length > 0
    ? dbPlans.map((p) => dbPlanToDisplay(p))
    : FALLBACK_PLANS;

  const planGridClass =
    plans.length <= 1 ? "lg:grid-cols-1"
    : plans.length === 2 ? "lg:grid-cols-2"
    : plans.length === 3 ? "lg:grid-cols-3"
    : "lg:grid-cols-4";

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />
      <PageSeo
        pageSlug="pricing"
        title="Pricing"
        description="Simple, transparent pricing for Amazon listing audits, AI content, and image generation. Start free and scale as you grow."
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-20 text-center">
        <Badge variant="outline" className="mb-6 border-orange-200 text-orange-600 bg-orange-50">
          Simple, transparent pricing
        </Badge>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">Choose your plan</h1>
        <p className="text-xl text-slate-500 max-w-xl mx-auto mb-10">Start free. Scale as you grow. No hidden fees.</p>
        <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
          <button onClick={() => setYearly(false)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Monthly</button>
          <button onClick={() => setYearly(true)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
            Yearly <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">Save 20%</span>
          </button>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="px-6 pb-20 -mt-6">
        <div className={cn("max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6", planGridClass)}>
          {plans.map((plan) => {
            const a = plan.creditAllocations ?? {};
            const totalCredits = computePlanCreditsFromAllocations(a, creditRules).totalCredits;

            const activityRows = [
              { label: "Audit", value: a.audit, color: "text-orange-700" },
              { label: "Text Content", value: a.content, color: "text-blue-700" },
              { label: "Images", value: a.images, color: "text-purple-700" },
              { label: "A+ / EBC Content", value: a.ebc, color: "text-emerald-700" },
              { label: "Competitors Analysis", value: a.competitors, color: "text-slate-700" },
              { label: "Team Members", value: a.teamMembers, color: "text-slate-700" },
            ];

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.isHighlighted
                    ? "border-orange-400 shadow-xl shadow-orange-100 bg-gradient-to-b from-orange-50 to-white"
                    : "border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                }`}
              >
                {plan.tag && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.tag}</span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{plan.description}</p>
                  {plan.monthlyPrice !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">
                        ${yearly && plan.yearlyPrice ? plan.yearlyPrice * 12 : plan.monthlyPrice}
                      </span>
                      <span className="text-slate-400 mb-1">{yearly && plan.yearlyPrice ? "/year" : "/mo"}</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-extrabold text-slate-900">Custom</div>
                  )}
                </div>

                <div className="space-y-2.5 flex-1 mb-5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wide border-b border-slate-100 pb-1.5">
                    <span>Item</span>
                    <span>Credits / Mo</span>
                  </div>
                  {activityRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{row.label}</span>
                      <span className={`font-semibold ${row.color}`}>
                        {typeof row.value === "number" ? row.value.toLocaleString() : "—"}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">Total Monthly Credits</span>
                      <span className="font-bold text-slate-900">{totalCredits.toLocaleString()}</span>
                    </div>
                  </div>

                  {plan.features.length > 0 && (
                    <div className="border-t border-slate-200 pt-3 mt-3 space-y-2">
                      {plan.features.map((feat) => (
                        <div
                          key={feat.text}
                          className={`flex items-start gap-2 text-sm ${feat.included ? "text-slate-600" : "text-slate-400"}`}
                        >
                          {feat.included ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span>{feat.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant={plan.ctaVariant}
                  className={`w-full ${plan.isHighlighted ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : ""}`}
                  asChild
                >
                  <Link href={plan.isEnterprise ? "/contact" : "/sign-up"}>
                    {plan.cta}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-ons */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Need more? Buy add-on credits</h2>
          <p className="text-slate-500 text-center mb-10">Top up whenever you need — credits never expire after purchase.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {addOns.map((a) => (
              <div key={a.name} className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
                <p className="text-sm text-slate-500 mb-1">{a.name}</p>
                <p className="text-2xl font-bold text-slate-900">{a.price}</p>
                <p className="text-xs text-slate-400 mt-1">{a.per}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="border border-slate-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 mb-2">{faq.q}</p>
                    <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-900 px-6 py-16 text-center">
        <Zap className="w-8 h-8 text-orange-400 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-3">Still deciding?</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">Book a 15-minute demo and we'll show you exactly how SellerLens works for your catalog.</p>
        <div className="flex items-center gap-4 justify-center flex-wrap">
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8" asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8" asChild>
            <Link href="/contact">Book a Demo</Link>
          </Button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
