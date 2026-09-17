export type HelpCmsMap = Record<string, string>;

export const MAX_HELP_CATEGORIES = 6;
export const MAX_HELP_ARTICLES_PER_CATEGORY = 10;

export const HELP_CMS_DEFAULTS: HelpCmsMap = {
  "hero.heading": "Help Center",
  "hero.subheading": "Search our knowledge base or browse by category.",
  "hero.search_placeholder": "Search articles, FAQs...",
  "browse.heading": "Browse by category",
  "faq.heading": "Frequently asked questions",
  "ticket.heading": "Submit a support ticket",
  "ticket.subheading": "Can't find your answer? We'll get back to you within 1 business day.",
  "cat1.title": "Getting Started",
  "cat1.icon": "book",
  "cat1.color": "text-orange-500",
  "cat1.bg": "bg-orange-50",
  "cat1.art1_title": "How to create your first audit",
  "cat1.art2_title": "Understanding your listing score",
  "cat1.art3_title": "Connecting your Amazon account",
  "cat1.art4_title": "Navigating the dashboard",
  "cat2.title": "Audits & Scoring",
  "cat2.icon": "search",
  "cat2.color": "text-blue-500",
  "cat2.bg": "bg-blue-50",
  "cat2.art1_title": "How scores are calculated",
  "cat2.art2_title": "What each score category means",
  "cat2.art3_title": "How to fix low-scoring sections",
  "cat2.art4_title": "Bulk audit multiple listings",
  "cat3.title": "AI Content & Images",
  "cat3.icon": "video",
  "cat3.color": "text-purple-500",
  "cat3.bg": "bg-purple-50",
  "cat3.art1_title": "Generating AI-optimized titles",
  "cat3.art2_title": "How to use the Image Studio",
  "cat3.art3_title": "Style presets explained",
  "cat3.art4_title": "Image version history",
  "cat4.title": "Billing & Credits",
  "cat4.icon": "message",
  "cat4.color": "text-green-500",
  "cat4.bg": "bg-green-50",
  "cat4.art1_title": "How credits work",
  "cat4.art2_title": "Buying add-on credits",
  "cat4.art3_title": "Changing your plan",
  "cat4.art4_title": "Download invoices",
};

export function mergeHelpCms(data?: HelpCmsMap | null): HelpCmsMap {
  return { ...HELP_CMS_DEFAULTS, ...(data ?? {}) };
}

export function helpCmsText(cms: HelpCmsMap, key: string): string {
  if (Object.prototype.hasOwnProperty.call(cms, key)) {
    return (cms[key] ?? "").trim();
  }
  return (HELP_CMS_DEFAULTS[key] ?? "").trim();
}

export function helpCategoryIndices(): number[] {
  return Array.from({ length: MAX_HELP_CATEGORIES }, (_, i) => i + 1);
}

export function helpArticleKeys(catIndex: number, artIndex: number) {
  const c = `cat${catIndex}`;
  return {
    title: `${c}.art${artIndex}_title`,
    link: `${c}.art${artIndex}_link`,
    faqId: `${c}.art${artIndex}_faq_id`,
  };
}

/** Link target for a help article (FAQ id wins over manual link). */
export function resolveHelpArticleLink(cms: HelpCmsMap, catIndex: number, artIndex: number): string {
  const ak = helpArticleKeys(catIndex, artIndex);
  const rawFaq = Object.prototype.hasOwnProperty.call(cms, ak.faqId)
    ? (cms[ak.faqId] ?? "").trim()
    : (cms[ak.faqId] ?? "").trim();
  const faqDigits = rawFaq.replace(/^#?faq-?/i, "").trim();
  if (faqDigits && /^\d+$/.test(faqDigits)) {
    return `#faq-${faqDigits}`;
  }
  if (Object.prototype.hasOwnProperty.call(cms, ak.link)) {
    return (cms[ak.link] ?? "").trim();
  }
  return (cms[ak.link] ?? "").trim();
}

export function clearHelpCategoryKeys(catIndex: number): string[] {
  const keys = helpCategoryKeys(catIndex);
  const out = [keys.title, keys.icon, keys.color, keys.bg];
  for (let j = 1; j <= MAX_HELP_ARTICLES_PER_CATEGORY; j++) {
    const ak = helpArticleKeys(catIndex, j);
    out.push(ak.title, ak.link, ak.faqId);
  }
  return out;
}

export function clearHelpArticleKeys(catIndex: number, artIndex: number): string[] {
  const ak = helpArticleKeys(catIndex, artIndex);
  return [ak.title, ak.link, ak.faqId];
}

export function helpCategoryKeys(catIndex: number) {
  const c = `cat${catIndex}`;
  return {
    title: `${c}.title`,
    icon: `${c}.icon`,
    color: `${c}.color`,
    bg: `${c}.bg`,
  };
}

export interface HelpCategoryView {
  id: number;
  title: string;
  icon: string;
  color: string;
  bg: string;
  articles: { title: string; link: string; faqId: string }[];
}

export function parseHelpCategories(cms: HelpCmsMap): HelpCategoryView[] {
  const out: HelpCategoryView[] = [];
  for (let i = 1; i <= MAX_HELP_CATEGORIES; i++) {
    const keys = helpCategoryKeys(i);
    const title = helpCmsText(cms, keys.title);
    if (!title) continue;
    const articles: { title: string; link: string; faqId: string }[] = [];
    for (let j = 1; j <= MAX_HELP_ARTICLES_PER_CATEGORY; j++) {
      const ak = helpArticleKeys(i, j);
      const artTitle = helpCmsText(cms, ak.title);
      if (!artTitle) continue;
      articles.push({
        title: artTitle,
        link: resolveHelpArticleLink(cms, i, j),
        faqId: Object.prototype.hasOwnProperty.call(cms, ak.faqId) ? (cms[ak.faqId] ?? "").trim() : "",
      });
    }
    out.push({
      id: i,
      title,
      icon: helpCmsText(cms, keys.icon) || "book",
      color: helpCmsText(cms, keys.color) || "text-slate-600",
      bg: helpCmsText(cms, keys.bg) || "bg-slate-50",
      articles,
    });
  }
  return out;
}
