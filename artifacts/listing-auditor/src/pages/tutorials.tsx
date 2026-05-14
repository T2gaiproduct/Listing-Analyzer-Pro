import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { Play, Clock, ChevronRight, Search, BookOpen, Wrench, BarChart3, Image, FileText } from "lucide-react";
import { useState } from "react";

const categories = [
  { id: "all", label: "All", icon: BookOpen },
  { id: "getting-started", label: "Getting Started", icon: Search },
  { id: "optimization", label: "Optimization", icon: Wrench },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "images", label: "Images & Content", icon: Image },
  { id: "reports", label: "Reports", icon: FileText },
];

const tutorials = [
  {
    id: 1,
    title: "How to Run Your First Listing Audit",
    category: "getting-started",
    duration: "3 min",
    description: "Learn how to paste any Amazon product URL and get a complete AI-powered audit in seconds.",
    steps: 4,
  },
  {
    id: 2,
    title: "Understanding Your Audit Score",
    category: "analytics",
    duration: "5 min",
    description: "Break down the 4 scoring categories — Title, Bullets, Images, and Keywords — and what each means.",
    steps: 6,
  },
  {
    id: 3,
    title: "Fixing Low-Scoring Titles",
    category: "optimization",
    duration: "7 min",
    description: "Step-by-step guide to rewriting product titles that rank higher and convert better.",
    steps: 5,
  },
  {
    id: 4,
    title: "Optimizing Bullet Points",
    category: "optimization",
    duration: "6 min",
    description: "Learn the proven frameworks for writing bullet points that highlight benefits and drive conversions.",
    steps: 5,
  },
  {
    id: 5,
    title: "Image Quality Scoring Explained",
    category: "images",
    duration: "4 min",
    description: "How our AI evaluates your product images and what you can do to improve your image score.",
    steps: 4,
  },
  {
    id: 6,
    title: "Competitor Analysis Workflow",
    category: "analytics",
    duration: "8 min",
    description: "Add competitor ASINs to your audit and see side-by-side strengths and weaknesses.",
    steps: 6,
  },
  {
    id: 7,
    title: "Generating AI-Optimized Content",
    category: "images",
    duration: "5 min",
    description: "Use AI to generate new titles, bullet points, and backend keywords in one click.",
    steps: 4,
  },
  {
    id: 8,
    title: "Downloading and Sharing Reports",
    category: "reports",
    duration: "3 min",
    description: "Export professional PDF reports to share with your team, clients, or stakeholders.",
    steps: 3,
  },
];

export default function Tutorials() {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = tutorials.filter((t) => {
    const matchCat = active === "all" || t.category === active;
    const matchSearch = t.title.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title="Help Center"
        description="Tutorials, guides, and best practices to get the most out of ListingAuditor for your Amazon listings."
      />
      <PublicNav />

      <main>
        {/* Hero */}
        <section className="bg-slate-900 text-white py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Help Center & Tutorials</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              Learn how to get the most out of ListingAuditor with step-by-step guides, video tutorials, and best practices.
            </p>
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tutorials..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="py-6 border-b border-slate-200 bg-white sticky top-[72px] z-10">
          <div className="max-w-6xl mx-auto px-8">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    active === c.id
                      ? "bg-orange-100 text-orange-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <c.icon className="w-4 h-4" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Tutorials Grid */}
        <section className="py-12 md:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-8">
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No tutorials found matching your search.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all group">
                    <div className="bg-slate-100 h-44 flex items-center justify-center relative">
                      <div className="w-14 h-14 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
                        <Play className="w-6 h-6 text-orange-600 ml-0.5" />
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          {categories.find((c) => c.id === t.category)?.label}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t.duration}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">{t.title}</h3>
                      <p className="text-sm text-slate-500 mb-4 leading-relaxed">{t.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{t.steps} steps</span>
                        <span className="text-xs text-slate-400">{t.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-white">
          <div className="max-w-xl mx-auto px-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Still need help?</h2>
            <p className="text-slate-500 mb-6">Our support team is here to help you get the most out of ListingAuditor.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/contact" className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors">
                Contact Support
              </Link>
              <Link href="/help" className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                Browse Help Center
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
