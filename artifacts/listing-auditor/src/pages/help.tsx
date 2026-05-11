import { useState } from "react";
import { Search, BookOpen, Video, MessageCircle, ChevronDown, ChevronUp, Ticket, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { PublicNav, PublicFooter } from "@/components/public-layout";

const categories = [
  {
    icon: BookOpen,
    title: "Getting Started",
    color: "text-orange-500",
    bg: "bg-orange-50",
    articles: [
      "How to create your first audit",
      "Understanding your listing score",
      "Connecting your Amazon account",
      "Navigating the dashboard",
    ],
  },
  {
    icon: Search,
    title: "Audits & Scoring",
    color: "text-blue-500",
    bg: "bg-blue-50",
    articles: [
      "How scores are calculated",
      "What each score category means",
      "How to fix low-scoring sections",
      "Bulk audit multiple listings",
    ],
  },
  {
    icon: Video,
    title: "AI Content & Images",
    color: "text-purple-500",
    bg: "bg-purple-50",
    articles: [
      "Generating AI-optimized titles",
      "How to use the Image Studio",
      "Style presets explained",
      "Image version history",
    ],
  },
  {
    icon: MessageCircle,
    title: "Billing & Credits",
    color: "text-green-500",
    bg: "bg-green-50",
    articles: [
      "How credits work",
      "Buying add-on credits",
      "Changing your plan",
      "Download invoices",
    ],
  },
];

const faqs = [
  {
    q: "How do I audit my first listing?",
    a: "Sign in, click 'New Audit' from the dashboard, enter your ASIN or paste your listing data manually, and click 'Run Audit'. Your results will appear within 30 seconds.",
  },
  {
    q: "What does the overall score mean?",
    a: "The overall score (0–100) is a weighted average of your title, bullet points, images, and keyword scores. A score above 80 is considered excellent. Below 60 needs significant improvement.",
  },
  {
    q: "Can I audit a listing I don't own?",
    a: "Yes — you can audit any Amazon listing using its ASIN. This is especially useful for competitor analysis. We'll compare it against best practices just like your own listings.",
  },
  {
    q: "How do I add team members?",
    a: "Go to Settings → Team, click 'Invite Member', enter their email, and assign a role. They'll receive an invitation email. Team seats depend on your plan.",
  },
  {
    q: "Do credits expire?",
    a: "Monthly plan credits reset at the start of each billing cycle. Add-on credits purchased separately never expire.",
  },
  {
    q: "How do I download my invoice?",
    a: "Go to Settings → Billing → Billing History, and click the download icon next to any invoice. All invoices are available as PDF.",
  },
  {
    q: "Can I export my audit results?",
    a: "Yes. On any audit detail page, click 'Export' in the top-right corner. You can export to PDF or CSV format.",
  },
  {
    q: "What image formats does the Image Studio support?",
    a: "Generated images are delivered as high-resolution PNG files (2048×2048 for main images). You can download them directly or regenerate with different prompts.",
  },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [ticketForm, setTicketForm] = useState({ email: "", subject: "", message: "" });
  const [ticketSent, setTicketSent] = useState(false);

  const filteredFaqs = faqs.filter(
    f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    await new Promise(r => setTimeout(r, 800));
    setTicketSent(true);
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-3">Help Center</h1>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">Search our knowledge base or browse by category.</p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search articles, FAQs..."
            className="pl-11 bg-white border-0 h-12 text-slate-900"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Browse by category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((cat) => (
              <div key={cat.title} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-4`}>
                  <cat.icon className={`w-5 h-5 ${cat.color}`} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-3">{cat.title}</h3>
                <ul className="space-y-2">
                  {cat.articles.map(a => (
                    <li key={a} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 cursor-pointer transition-colors">
                      <ArrowRight className="w-3 h-3 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Frequently asked questions</h2>
          <p className="text-slate-500 text-center mb-8">
            {search ? `${filteredFaqs.length} result${filteredFaqs.length !== 1 ? "s" : ""} for "${search}"` : "Quick answers to common questions"}
          </p>
          <div className="space-y-3">
            {filteredFaqs.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-slate-900 text-sm pr-4">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-10 text-slate-400">No results found. Try a different search or submit a ticket below.</div>
            )}
          </div>
        </div>
      </section>

      {/* Submit a ticket */}
      <section className="px-6 py-16">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-2 justify-center">
            <Ticket className="w-5 h-5 text-orange-500" />
            <h2 className="text-2xl font-bold text-slate-900">Submit a support ticket</h2>
          </div>
          <p className="text-slate-500 text-center mb-8">Can't find your answer? We'll get back to you within 1 business day.</p>

          {ticketSent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <Badge className="bg-green-100 text-green-700 mb-3">Ticket submitted</Badge>
              <p className="text-slate-700 font-semibold">We've received your request.</p>
              <p className="text-slate-500 text-sm mt-1">Expect a reply within 1 business day.</p>
            </div>
          ) : (
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your email *</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={ticketForm.email}
                  onChange={e => setTicketForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <Input
                  placeholder="Briefly describe your issue"
                  required
                  value={ticketForm.subject}
                  onChange={e => setTicketForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Details *</label>
                <textarea
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  placeholder="Describe the issue in as much detail as possible..."
                  required
                  value={ticketForm.message}
                  onChange={e => setTicketForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Submit Ticket
              </Button>
            </form>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
