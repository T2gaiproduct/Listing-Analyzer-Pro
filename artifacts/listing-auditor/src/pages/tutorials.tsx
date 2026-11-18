import { PublicNav, PublicFooter } from "@/components/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";
import { cmsText } from "@/lib/homepage-cms";
import {
  buildTutorialPreviewItems,
  tutorialCategoryLabel,
} from "@/lib/tutorials-cms";
import { TutorialCard } from "@/components/tutorial-card";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Tutorials() {
  const cms = useHomepageCmsContext();
  const [query, setQuery] = useState("");

  const tutorials = useMemo(
    () => buildTutorialPreviewItems(cms, basePath).map((item) => ({
      ...item,
      categoryLabel: tutorialCategoryLabel(item.category ?? "getting-started"),
    })),
    [cms],
  );

  const filtered = tutorials.filter((t) => {
    const haystack = `${t.title} ${t.description ?? ""} ${t.sop ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="min-h-[100dvh] bg-white">
      <SeoHead
        title="Help Center"
        description={cmsText(cms, "tutorials_page.subheading")}
      />
      <PublicNav />

      <main>
        <section className="bg-slate-900 text-white py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {cmsText(cms, "tutorials_page.heading")}
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              {cmsText(cms, "tutorials_page.subheading")}
            </p>
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={cmsText(cms, "tutorials_page.search_placeholder")}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </section>

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
                  <TutorialCard
                    key={t.title}
                    {...t}
                    layout="page"
                    categoryLabel={t.categoryLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-xl mx-auto px-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {cmsText(cms, "tutorials_page.cta_heading")}
            </h2>
            <p className="text-slate-500 mb-6">
              {cmsText(cms, "tutorials_page.cta_subheading")}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={cmsText(cms, "tutorials_page.cta_primary_url")}
                className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
              >
                {cmsText(cms, "tutorials_page.cta_primary_text")}
              </Link>
              <Link
                href={cmsText(cms, "tutorials_page.cta_secondary_url")}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {cmsText(cms, "tutorials_page.cta_secondary_text")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
