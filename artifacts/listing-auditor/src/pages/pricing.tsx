import { useState } from "react";
import { Link } from "wouter";
import { Check, X, Zap, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";

const plans = [
  {
    name: "Starter",
    tag: null,
    monthlyPrice: 29,
    yearlyPrice: 23,
    description: "Perfect for solo sellers getting started with AI optimization.",
    aiCredits: 100,
    imageCredits: 20,
    auditCredits: 10,
    teamMembers: 1,
    features: [
      { text: "10 listing audits/mo", included: true },
      { text: "100 AI content credits", included: true },
      { text: "20 image generation credits", included: true },
      { text: "Competitor comparison", included: true },
      { text: "Score breakdown & suggestions", included: true },
      { text: "Email support", included: true },
      { text: "Team members", included: false },
      { text: "API access", included: false },
      { text: "White-label reports", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
  },
  {
    name: "Growth",
    tag: "Most Popular",
    monthlyPrice: 79,
    yearlyPrice: 63,
    description: "For growing brands that need more power and faster results.",
    aiCredits: 500,
    imageCredits: 100,
    auditCredits: 50,
    teamMembers: 3,
    features: [
      { text: "50 listing audits/mo", included: true },
      { text: "500 AI content credits", included: true },
      { text: "100 image generation credits", included: true },
      { text: "Competitor comparison", included: true },
      { text: "Score breakdown & suggestions", included: true },
      { text: "Priority email support", included: true },
      { text: "3 team members", included: true },
      { text: "API access", included: false },
      { text: "White-label reports", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "default" as const,
  },
  {
    name: "Pro",
    tag: "Best Value",
    monthlyPrice: 149,
    yearlyPrice: 119,
    description: "For agencies and power sellers with high-volume needs.",
    aiCredits: 2000,
    imageCredits: 400,
    auditCredits: 200,
    teamMembers: 10,
    features: [
      { text: "Unlimited listing audits", included: true },
      { text: "2,000 AI content credits", included: true },
      { text: "400 image generation credits", included: true },
      { text: "Competitor comparison", included: true },
      { text: "Score breakdown & suggestions", included: true },
      { text: "Dedicated support", included: true },
      { text: "10 team members", included: true },
      { text: "API access", included: true },
      { text: "White-label reports", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
  },
  {
    name: "Enterprise",
    tag: null,
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Custom solution for large agencies and enterprise brands.",
    aiCredits: null,
    imageCredits: null,
    auditCredits: null,
    teamMembers: null,
    features: [
      { text: "Unlimited everything", included: true },
      { text: "Custom AI credit allocation", included: true },
      { text: "Unlimited image generation", included: true },
      { text: "Competitor comparison", included: true },
      { text: "Score breakdown & suggestions", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Full API access", included: true },
      { text: "White-label reports", included: true },
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
  },
];

const addOns = [
  { name: "AI Content Credits", price: "$9", per: "100 credits" },
  { name: "Image Generation Credits", price: "$12", per: "25 images" },
  { name: "Additional Audit Credits", price: "$15", per: "20 audits" },
  { name: "Extra Team Seat", price: "$8", per: "per seat/month" },
];

const faqs = [
  {
    q: "What are credits?",
    a: "Credits are the currency for AI operations. AI content credits power title/bullet rewrites and keyword suggestions. Image credits generate professional product photos. Audit credits run full listing analyses.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes — upgrade or downgrade anytime from your billing settings. Upgrades take effect immediately; downgrades apply at the next billing cycle.",
  },
  {
    q: "Is there a free trial?",
    a: "All paid plans include a 7-day free trial. No credit card required to start.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Credits reset monthly. Any unused credits from the previous cycle do not roll over, but you can purchase add-on credits at any time.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for Enterprise plans.",
  },
  {
    q: "Can I get a refund?",
    a: "We offer a 7-day money-back guarantee on all plans. Enterprise plans are handled case-by-case — contact our sales team.",
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-20 text-center">
        <Badge variant="outline" className="mb-6 border-orange-200 text-orange-600 bg-orange-50">
          Simple, transparent pricing
        </Badge>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Choose your plan
        </h1>
        <p className="text-xl text-slate-500 max-w-xl mx-auto mb-10">
          Start free. Scale as you grow. No hidden fees.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
          >
            Yearly
            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">Save 20%</span>
          </button>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="px-6 pb-20 -mt-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.tag === "Most Popular"
                  ? "border-orange-400 shadow-xl shadow-orange-100 bg-gradient-to-b from-orange-50 to-white"
                  : "border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              }`}
            >
              {plan.tag && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.tag}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">
                      ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-slate-400 mb-1">/mo</span>
                  </div>
                ) : (
                  <div className="text-3xl font-extrabold text-slate-900">Custom</div>
                )}
                {yearly && plan.yearlyPrice && (
                  <p className="text-xs text-green-600 mt-1">Billed ${plan.yearlyPrice! * 12}/year</p>
                )}
              </div>

              {/* Credit badges */}
              {plan.aiCredits !== null && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md font-medium">{plan.aiCredits} AI credits</span>
                  <span className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-md font-medium">{plan.imageCredits} images</span>
                  <span className="bg-orange-50 text-orange-700 text-xs px-2 py-1 rounded-md font-medium">{plan.auditCredits} audits</span>
                </div>
              )}

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-center gap-2 text-sm">
                    {f.included ? (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span className={f.included ? "text-slate-700" : "text-slate-400"}>{f.text}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.ctaVariant}
                className={`w-full ${plan.tag === "Most Popular" ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : ""}`}
                asChild
              >
                <Link href={plan.name === "Enterprise" ? "/contact" : "/sign-up"}>
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
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
        <p className="text-slate-400 mb-8 max-w-md mx-auto">Book a 15-minute demo and we'll show you exactly how ListingAuditor works for your catalog.</p>
        <div className="flex items-center gap-4 justify-center flex-wrap">
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8" asChild>
            <Link href="/sign-up">Start Free Trial</Link>
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
