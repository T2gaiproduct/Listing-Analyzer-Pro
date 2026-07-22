import { PublicNav, PublicFooter } from "@/components/public-layout";
import { PageSeo } from "@/components/page-seo";
import { Zap, Target, Users, Globe, Award, Heart } from "lucide-react";

const values = [
  { icon: Target, title: "Results-Driven", desc: "Every feature we build is designed to improve your Amazon rankings and conversion rates." },
  { icon: Zap, title: "AI-Powered", desc: "We use cutting-edge language models to deliver insights no human can match at scale." },
  { icon: Users, title: "Seller-First", desc: "Built by Amazon sellers, for Amazon sellers. We understand the platform inside and out." },
  { icon: Globe, title: "Global Reach", desc: "Supporting sellers across all Amazon marketplaces: US, UK, EU, Japan, and more." },
  { icon: Award, title: "Excellence", desc: "We obsess over data quality, accuracy, and actionable recommendations." },
  { icon: Heart, title: "Community", desc: "Thousands of sellers trust us to optimize their listings and grow their business." },
];

const milestones = [
  { year: "2024", title: "Founded", desc: "SellerLens launched with a mission to democratize Amazon listing optimization." },
  { year: "2025", title: "First 1,000 Sellers", desc: "Reached our first milestone of helping 1,000 active Amazon sellers improve their listings." },
  { year: "2025", title: "AI Expansion", desc: "Added AI content generation, image studio, and EBC module creation." },
  { year: "2026", title: "Enterprise Launch", desc: "Launched enterprise tier with team management, white-label reporting, and API access." },
];

export default function About() {
  return (
    <div className="min-h-[100dvh] bg-white">
      <PageSeo
        pageSlug="about"
        title="About Us"
        description="Meet the team behind SellerLens and learn how we're helping Amazon sellers optimize listings with AI-powered audits."
      />
      <PublicNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-900 text-white py-24 md:py-32">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
          </div>
          <div className="relative max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Built for Amazon sellers,<br />by Amazon sellers
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              SellerLens was created to solve a problem every Amazon seller faces:
              knowing whether their listings are good enough to win the Buy Box and rank on page one.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Our Mission</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  We believe every Amazon seller deserves access to world-class listing optimization tools —
                  not just the ones with big agencies or deep pockets. Our AI-powered platform levels the playing field.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  From title analysis to image quality scoring, keyword research to competitor benchmarking,
                  we give sellers the data and insights they need to make smarter decisions and sell more.
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Instant Analysis</p>
                      <p className="text-sm text-slate-500">Get full audit results in under 60 seconds</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Target className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Data-Driven</p>
                      <p className="text-sm text-slate-500">Scores based on real Amazon ranking factors</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Community Powered</p>
                      <p className="text-sm text-slate-500">Feedback from thousands of active sellers</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 md:py-28 bg-slate-50">
          <div className="max-w-6xl mx-auto px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">Our Values</h2>
              <p className="text-slate-500 max-w-xl mx-auto">The principles that guide every decision we make.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((v) => (
                <div key={v.title} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                  <v.icon className="w-8 h-8 text-orange-500 mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-4xl mx-auto px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">Our Journey</h2>
              <p className="text-slate-500">How SellerLens has evolved.</p>
            </div>
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-6">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                      {m.year.slice(-2)}
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200 mt-2" />
                    )}
                  </div>
                  <div className="pb-8">
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">{m.year}</span>
                    <h3 className="font-semibold text-slate-900 mt-1">{m.title}</h3>
                    <p className="text-slate-500 mt-1 text-sm">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
