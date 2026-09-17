import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { mapPublicFaqs, usePublicFaqs } from "@/lib/public-faqs";
import { PageSeo } from "@/components/page-seo";
import {
  Search,
  BookOpen,
  Video,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Ticket,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { useHelpCms } from "@/hooks/use-help-cms";
import { helpCmsText, parseHelpCategories } from "@/lib/help-cms";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  search: Search,
  video: Video,
  message: MessageCircle,
};

function signInHrefForReturn(): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  return `${basePath}/sign-in?redirect_url=${returnTo}`;
}

function ArticleLink({ title, link, onFaqAnchor }: { title: string; link: string; onFaqAnchor: (id: number) => void }) {
  const trimmed = link.trim();
  const faqMatch = trimmed.match(/^#faq-(\d+)$/i);
  if (faqMatch) {
    const id = Number(faqMatch[1]);
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 cursor-pointer transition-colors text-left"
        onClick={() => onFaqAnchor(id)}
      >
        <ArrowRight className="w-3 h-3 flex-shrink-0" />
        {title}
      </button>
    );
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("http")) {
    const href = trimmed.startsWith("http") ? trimmed : trimmed;
    if (trimmed.startsWith("http")) {
      return (
        <a href={href} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 transition-colors">
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          {title}
        </a>
      );
    }
    return (
      <Link href={href} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 transition-colors">
        <ArrowRight className="w-3 h-3 flex-shrink-0" />
        {title}
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-sm text-slate-500">
      <ArrowRight className="w-3 h-3 flex-shrink-0" />
      {title}
    </span>
  );
}

export default function Help() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const { data: dbFaqs = [], isLoading: faqsLoading } = usePublicFaqs();
  const { data: helpCms = {}, isLoading: helpCmsLoading } = useHelpCms();
  const faqs = mapPublicFaqs(dbFaqs);
  const categories = useMemo(() => parseHelpCategories(helpCms), [helpCms]);

  const [ticketForm, setTicketForm] = useState({ email: "", subject: "", message: "" });
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  useEffect(() => {
    if (isSignedIn && accountEmail) {
      setTicketForm((f) => ({ ...f, email: accountEmail }));
    }
  }, [isSignedIn, accountEmail]);

  const filteredFaqs = faqs.filter(
    (f) => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        articles: cat.articles.filter((a) => a.title.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.title.toLowerCase().includes(q) || cat.articles.length > 0);
  }, [categories, search]);

  function scrollToFaq(id: number) {
    setOpenFaqId(id);
    requestAnimationFrame(() => {
      document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) return;
    setTicketError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "support",
          data: { subject: ticketForm.subject, message: ticketForm.message },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to submit ticket");
      }
      setTicketSent(true);
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PageSeo
        pageSlug="help"
        title={helpCmsText(helpCms, "hero.heading")}
        description={helpCmsText(helpCms, "hero.subheading")}
      />
      <PublicNav />

      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-3">{helpCmsText(helpCms, "hero.heading")}</h1>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">{helpCmsText(helpCms, "hero.subheading")}</p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={helpCmsText(helpCms, "hero.search_placeholder")}
            className="pl-11 bg-white border-0 h-12 text-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">{helpCmsText(helpCms, "browse.heading")}</h2>
          {helpCmsLoading ? (
            <div className="text-center text-slate-400 py-10">Loading…</div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center text-slate-400 py-10">No categories match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredCategories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.icon] ?? BookOpen;
                return (
                  <div key={cat.id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-3">{cat.title}</h3>
                    <ul className="space-y-2">
                      {cat.articles.map((a) => (
                        <li key={`${cat.id}-${a.title}`}>
                          <ArticleLink title={a.title} link={a.link} onFaqAnchor={scrollToFaq} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {(faqsLoading || faqs.length > 0) && (
      <section className="bg-slate-50 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">{helpCmsText(helpCms, "faq.heading")}</h2>
          <p className="text-slate-500 text-center mb-8">
            {search ? `${filteredFaqs.length} result${filteredFaqs.length !== 1 ? "s" : ""} for "${search}"` : "Quick answers to common questions"}
          </p>
          <div className="space-y-3">
            {faqsLoading ? (
              <div className="text-center py-10 text-slate-400">Loading FAQs…</div>
            ) : filteredFaqs.map((faq) => (
              <div key={faq.id} id={`faq-${faq.id}`} className="bg-white border border-slate-200 rounded-xl overflow-hidden scroll-mt-24">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                >
                  <span className="font-semibold text-slate-900 text-sm pr-4">{faq.q}</span>
                  {openFaqId === faq.id
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>
                {openFaqId === faq.id && (
                  <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
            {!faqsLoading && filteredFaqs.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                {search
                  ? (isSignedIn
                    ? "No results found. Try a different search or submit a ticket below."
                    : "No results found. Sign in below to submit a support ticket.")
                  : "No FAQs published yet."}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      <section className="px-6 py-16">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-2 justify-center">
            <Ticket className="w-5 h-5 text-orange-500" />
            <h2 className="text-2xl font-bold text-slate-900">{helpCmsText(helpCms, "ticket.heading")}</h2>
          </div>
          <p className="text-slate-500 text-center mb-8">{helpCmsText(helpCms, "ticket.subheading")}</p>

          {ticketSent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <Badge className="bg-green-100 text-green-700 mb-3">Ticket submitted</Badge>
              <p className="text-slate-700 font-semibold">We've received your request.</p>
              <p className="text-slate-500 text-sm mt-1">Expect a reply within 1 business day.</p>
            </div>
          ) : !isLoaded ? (
            <p className="text-center text-slate-500 text-sm">Loading…</p>
          ) : !isSignedIn ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-4">
              <p className="text-slate-700 font-medium">Sign in to submit a support ticket</p>
              <p className="text-slate-500 text-sm">
                Support tickets are tied to your account so we can help you faster. Contact and sales forms on{" "}
                <Link href="/contact" className="text-orange-600 hover:underline font-medium">Contact</Link> remain available without signing in.
              </p>
              <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
                <a href={signInHrefForReturn()}>Sign in</a>
              </Button>
            </div>
          ) : (
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your account email</label>
                <Input type="email" value={accountEmail} readOnly disabled className="bg-slate-50 text-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <Input
                  placeholder="Briefly describe your issue"
                  required
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Details *</label>
                <textarea
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  placeholder="Describe the issue in as much detail as possible..."
                  required
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={submitting || !ticketForm.subject.trim() || !ticketForm.message.trim()}
              >
                {submitting ? "Submitting…" : "Submit Ticket"}
              </Button>
              {ticketError && <p className="text-sm text-red-600 text-center">{ticketError}</p>}
            </form>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
