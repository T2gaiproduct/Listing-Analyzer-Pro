import { useState } from "react";
import { CheckCircle2, Building2, Users, Zap, Shield, Globe, Code2, ArrowRight, Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";

const features = [
  {
    icon: Building2,
    title: "Custom AI credit allocation",
    desc: "Unlimited or custom-capped credits across AI content, image generation, and audits — tailored to your volume.",
  },
  {
    icon: Users,
    title: "Unlimited team members",
    desc: "Add your entire agency or in-house team. Role-based access control for every seat.",
  },
  {
    icon: Zap,
    title: "Full API access",
    desc: "Integrate our audit and content generation capabilities directly into your own tools and workflows.",
  },
  {
    icon: Globe,
    title: "White-label reports",
    desc: "Brand audit reports with your logo and domain. Share professional PDF reports with clients.",
  },
  {
    icon: Shield,
    title: "Dedicated account manager",
    desc: "A named point of contact for onboarding, support, and strategic guidance throughout your contract.",
  },
  {
    icon: Code2,
    title: "Custom integrations",
    desc: "We'll build bespoke integrations to connect ListingAuditor with your existing PIM, ERP, or agency tools.",
  },
];

const stats = [
  { value: "3,200+", label: "Enterprise listings managed" },
  { value: "94%", label: "Avg. score improvement" },
  { value: "2.4×", label: "Avg. revenue lift reported" },
  { value: "48h", label: "Avg. onboarding time" },
];

const testimonials = [
  {
    quote: "We manage 500+ ASINs for 12 brands. ListingAuditor's enterprise plan cut our audit time from hours to minutes and the white-label reports are a game-changer for client deliverables.",
    name: "James R.",
    role: "Head of Marketplace, Clarity Agency",
  },
  {
    quote: "The API integration was seamless. We pipe listing data directly from our PIM and get audit scores back in real time. Absolutely transformative for our workflow.",
    name: "Priya S.",
    role: "Director of eCommerce, Horizon Brands",
  },
];

export default function Enterprise() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", company: "", teamSize: "", phone: "", message: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,128,0,0.08),transparent_70%)]" />
        <div className="relative">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-6">Enterprise</Badge>
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4 max-w-3xl mx-auto">
            Scale your Amazon operations with confidence
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Custom pricing, unlimited capacity, white-label reports, full API access, and a dedicated account manager. Built for agencies and enterprise brands.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white px-8" onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}>
              Contact Sales <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8">
              Download Overview PDF
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100 px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-orange-500">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">Everything in Pro, plus…</h2>
          <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">Enterprise gives you full control, unlimited scale, and hands-on support from day one.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Trusted by agencies & enterprise teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-orange-400 text-orange-400" />)}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plan comparison callout */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto bg-slate-900 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">What's included vs. Pro</h2>
          <div className="space-y-3">
            {[
              ["Team members", "Up to 10", "Unlimited"],
              ["Listing audits", "Unlimited", "Unlimited"],
              ["AI content credits", "2,000/mo", "Custom allocation"],
              ["Image generation", "400/mo", "Custom allocation"],
              ["API access", "✓", "Full + webhooks"],
              ["White-label reports", "✗", "✓"],
              ["Account manager", "✗", "Dedicated"],
              ["Custom integrations", "✗", "✓"],
              ["SLA uptime guarantee", "✗", "99.9% SLA"],
            ].map(([feature, pro, ent]) => (
              <div key={feature} className="grid grid-cols-3 gap-4 py-3 border-b border-slate-700 last:border-0">
                <span className="text-slate-300 text-sm">{feature}</span>
                <span className="text-slate-400 text-sm text-center">{pro}</span>
                <span className="text-orange-400 text-sm text-center font-semibold">{ent}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-2">
            <span />
            <span className="text-center text-xs text-slate-500">Pro</span>
            <span className="text-center text-xs text-orange-400 font-semibold">Enterprise</span>
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact-form" className="bg-orange-50 border-t border-orange-100 px-6 py-20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-2">Talk to our sales team</h2>
          <p className="text-slate-500 text-center mb-8">We'll build a custom plan around your catalog size, team, and goals.</p>

          {submitted ? (
            <div className="bg-white border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Request received!</h3>
              <p className="text-slate-500 text-sm">Our enterprise team will be in touch within 1 business day with a tailored proposal.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-orange-200 rounded-2xl p-7 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full name *</Label>
                  <Input id="name" name="name" value={form.name} onChange={handleChange} required className="mt-1" placeholder="Jane Smith" />
                </div>
                <div>
                  <Label htmlFor="email">Work email *</Label>
                  <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className="mt-1" placeholder="jane@company.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company">Company *</Label>
                  <Input id="company" name="company" value={form.company} onChange={handleChange} required className="mt-1" placeholder="Acme Agency" />
                </div>
                <div>
                  <Label htmlFor="teamSize">Team size *</Label>
                  <select
                    id="teamSize"
                    name="teamSize"
                    value={form.teamSize}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Select…</option>
                    <option>1–5</option>
                    <option>6–20</option>
                    <option>21–50</option>
                    <option>51–200</option>
                    <option>200+</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" name="phone" value={form.phone} onChange={handleChange} className="mt-1" placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <Label htmlFor="message">Tell us about your needs</Label>
                <Textarea id="message" name="message" value={form.message} onChange={handleChange} rows={4} className="mt-1" placeholder="Catalog size, current tools, pain points, goals..." />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {loading ? "Sending..." : <><Send className="w-4 h-4 mr-2" />Request Enterprise Proposal</>}
              </Button>
            </form>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
