type FieldType = "text" | "textarea" | "url" | "select";

export type CmsField = {
  key: string;
  label: string;
  type?: FieldType;
  rows?: number;
  options?: { value: string; label: string }[];
};

export type CmsSection = { title: string; fields: CmsField[] };

const BOOL_OPTIONS = [
  { value: "true", label: "Visible" },
  { value: "false", label: "Hidden" },
];

const FIT_OPTIONS = [
  { value: "cover", label: "Cover (fill tile)" },
  { value: "contain", label: "Contain (show full image)" },
];

function portfolioItemFields(index: number): CmsField[] {
  return [
    { key: `portfolio.item${index}_title`, label: `Item ${index} title` },
    { key: `portfolio.item${index}_brand`, label: `Item ${index} brand` },
    { key: `portfolio.item${index}_badge`, label: `Item ${index} badge (optional)` },
    { key: `portfolio.item${index}_image`, label: `Item ${index} image URL`, type: "url" },
    { key: `portfolio.item${index}_fit`, label: `Item ${index} image fit`, type: "select", options: FIT_OPTIONS },
  ];
}

function featureItemFields(index: number): CmsField[] {
  return [
    { key: `features.item${index}_title`, label: `Feature ${index} title` },
    { key: `features.item${index}_desc`, label: `Feature ${index} description`, type: "textarea" },
    { key: `features.item${index}_href`, label: `Feature ${index} link URL`, type: "url" },
  ];
}

function tutorialItemFields(index: number): CmsField[] {
  return [
    { key: `tutorials.item${index}_title`, label: `Tutorial ${index} title` },
    { key: `tutorials.item${index}_duration`, label: `Tutorial ${index} duration` },
    { key: `tutorials.item${index}_image`, label: `Tutorial ${index} image URL`, type: "url" },
  ];
}

function faqPairFields(index: number): CmsField[] {
  return [
    { key: `faq.q${index}`, label: `Question ${index}` },
    { key: `faq.a${index}`, label: `Answer ${index}`, type: "textarea" },
  ];
}

export const HOMEPAGE_CMS_SECTIONS: Record<string, CmsSection[]> = {
  sections: [
    {
      title: "Section visibility",
      fields: [
        { key: "sections.promo.enabled", label: "Promo banner", type: "select", options: BOOL_OPTIONS },
        { key: "sections.hero.enabled", label: "Hero", type: "select", options: BOOL_OPTIONS },
        { key: "sections.features.enabled", label: "Features", type: "select", options: BOOL_OPTIONS },
        { key: "sections.portfolio.enabled", label: "Portfolio", type: "select", options: BOOL_OPTIONS },
        { key: "sections.workflow.enabled", label: "Workflow", type: "select", options: BOOL_OPTIONS },
        { key: "sections.tutorials.enabled", label: "Tutorials", type: "select", options: BOOL_OPTIONS },
        { key: "sections.pricing.enabled", label: "Pricing", type: "select", options: BOOL_OPTIONS },
        { key: "sections.social.enabled", label: "Testimonials", type: "select", options: BOOL_OPTIONS },
        { key: "sections.faq.enabled", label: "FAQ", type: "select", options: BOOL_OPTIONS },
        { key: "sections.cta.enabled", label: "Pre-footer CTA", type: "select", options: BOOL_OPTIONS },
      ],
    },
  ],
  promo: [
    {
      title: "Promo banner",
      fields: [
        { key: "promo.text", label: "Promo text (before code)" },
        { key: "promo.code", label: "Promo code" },
        { key: "promo.link_text", label: "Link text" },
        { key: "promo.link_url", label: "Link URL", type: "url" },
      ],
    },
  ],
  nav: [
    {
      title: "Navigation CTAs",
      fields: [
        { key: "nav.sign_in_text", label: "Sign in button text" },
        { key: "nav.sign_in_url", label: "Sign in URL", type: "url" },
        { key: "nav.cta_text", label: "Primary CTA text" },
        { key: "nav.cta_url", label: "Primary CTA URL", type: "url" },
      ],
    },
  ],
  seo: [
    {
      title: "Homepage SEO",
      fields: [
        { key: "seo.title", label: "Page title" },
        { key: "seo.description", label: "Meta description", type: "textarea" },
      ],
    },
  ],
  hero: [
    {
      title: "Hero section",
      fields: [
        { key: "hero.badge_text", label: "Badge text" },
        { key: "hero.heading_line1", label: "Heading line 1" },
        { key: "hero.heading_highlight", label: "Heading highlight (orange)" },
        { key: "hero.subheading", label: "Subheading", type: "textarea", rows: 3 },
        { key: "hero.cta_primary_text", label: "Primary CTA text" },
        { key: "hero.cta_primary_url", label: "Primary CTA URL", type: "url" },
        { key: "hero.cta_secondary_text", label: "Secondary CTA text" },
        { key: "hero.cta_secondary_url", label: "Secondary CTA URL", type: "url" },
        { key: "hero.stat1_value", label: "Stat 1 value" },
        { key: "hero.stat1_label", label: "Stat 1 label" },
        { key: "hero.stat2_value", label: "Stat 2 value" },
        { key: "hero.stat2_label", label: "Stat 2 label" },
        { key: "hero.stat3_value", label: "Stat 3 value" },
        { key: "hero.stat3_label", label: "Stat 3 label" },
        { key: "hero.stat4_value", label: "Stat 4 value" },
        { key: "hero.stat4_label", label: "Stat 4 label" },
      ],
    },
  ],
  features: [
    {
      title: "Features section",
      fields: [
        { key: "features.eyebrow", label: "Eyebrow (mobile)" },
        { key: "features.heading", label: "Section heading" },
        { key: "features.subheading", label: "Section subheading", type: "textarea", rows: 2 },
        ...Array.from({ length: 5 }, (_, i) => featureItemFields(i + 1)).flat(),
      ],
    },
  ],
  portfolio: [
    {
      title: "Portfolio section",
      fields: [
        { key: "portfolio.heading", label: "Section heading" },
        { key: "portfolio.subheading", label: "Section subheading", type: "textarea", rows: 2 },
        { key: "portfolio.cta_text", label: "CTA link text" },
        { key: "portfolio.cta_url", label: "CTA link URL", type: "url" },
        ...Array.from({ length: 8 }, (_, i) => portfolioItemFields(i + 1)).flat(),
      ],
    },
  ],
  workflow: [
    {
      title: "Workflow section",
      fields: [
        { key: "workflow.heading", label: "Section heading" },
        { key: "workflow.step1_label", label: "Step 1 label" },
        { key: "workflow.step2_label", label: "Step 2 label" },
        { key: "workflow.step3_label", label: "Step 3 label" },
        { key: "workflow.step4_label", label: "Step 4 label" },
        { key: "workflow.step5_label", label: "Step 5 label" },
        { key: "workflow.step6_label", label: "Step 6 label" },
        { key: "workflow.before_label", label: "Before card label" },
        { key: "workflow.before_score", label: "Before score" },
        { key: "workflow.before_image", label: "Before image URL", type: "url" },
        { key: "workflow.after_label", label: "After card label" },
        { key: "workflow.after_badge", label: "After badge text" },
        { key: "workflow.after_score", label: "After score" },
        { key: "workflow.after_image", label: "After image URL", type: "url" },
        { key: "workflow.metrics_heading", label: "Metrics heading" },
        { key: "workflow.metric1_value", label: "Metric 1 value" },
        { key: "workflow.metric1_label", label: "Metric 1 label" },
        { key: "workflow.metric2_value", label: "Metric 2 value" },
        { key: "workflow.metric2_label", label: "Metric 2 label" },
        { key: "workflow.metric3_value", label: "Metric 3 value" },
        { key: "workflow.metric3_label", label: "Metric 3 label" },
        { key: "workflow.metric4_value", label: "Metric 4 value" },
        { key: "workflow.metric4_label", label: "Metric 4 label" },
      ],
    },
  ],
  tutorials: [
    {
      title: "Tutorials section",
      fields: [
        { key: "tutorials.heading", label: "Section heading" },
        { key: "tutorials.cta_text", label: "CTA link text" },
        { key: "tutorials.cta_url", label: "CTA link URL", type: "url" },
        ...Array.from({ length: 5 }, (_, i) => tutorialItemFields(i + 1)).flat(),
      ],
    },
  ],
  pricing: [
    {
      title: "Pricing section (headings only — plans come from Admin → Plans)",
      fields: [
        { key: "pricing.eyebrow", label: "Eyebrow" },
        { key: "pricing.heading", label: "Section heading" },
        { key: "pricing.footer_text", label: "Footer text" },
        { key: "pricing.footer_link_text", label: "Footer link text" },
        { key: "pricing.footer_link_url", label: "Footer link URL", type: "url" },
      ],
    },
  ],
  faq: [
    {
      title: "FAQ section (heading only — Q&A items come from Website CMS → FAQ)",
      fields: [
        { key: "faq.heading", label: "Section heading" },
        ...Array.from({ length: 5 }, (_, i) => faqPairFields(i + 1)).flat(),
      ],
    },
  ],
  social: [
    {
      title: "Testimonials section (cards come from Website CMS → Testimonials)",
      fields: [
        { key: "social.trusted_heading", label: "Section heading" },
        { key: "social.stats_customers", label: "Stat: customers" },
        { key: "social.stats_audits", label: "Stat: audits completed" },
        { key: "social.stats_countries", label: "Stat: countries" },
        { key: "social.stats_rating", label: "Stat: average rating" },
      ],
    },
  ],
  cta: [
    {
      title: "Pre-footer CTA",
      fields: [
        { key: "cta.heading", label: "Heading" },
        { key: "cta.subheading", label: "Subheading", type: "textarea", rows: 2 },
        { key: "cta.primary_text", label: "Primary CTA text" },
        { key: "cta.primary_url", label: "Primary CTA URL", type: "url" },
        { key: "cta.secondary_text", label: "Secondary CTA text" },
        { key: "cta.secondary_url", label: "Secondary CTA URL", type: "url" },
      ],
    },
  ],
  footer: [
    {
      title: "Footer",
      fields: [
        { key: "footer.tagline", label: "Tagline", type: "textarea", rows: 2 },
        { key: "footer.copyright", label: "Copyright suffix" },
        { key: "footer.social_twitter", label: "Twitter URL", type: "url" },
        { key: "footer.social_linkedin", label: "LinkedIn URL", type: "url" },
        { key: "footer.social_youtube", label: "YouTube URL", type: "url" },
        { key: "footer.social_facebook", label: "Facebook URL", type: "url" },
      ],
    },
  ],
};

export const HOMEPAGE_CMS_TAB_LABELS: Record<string, string> = {
  sections: "Visibility",
  promo: "Promo",
  nav: "Navigation",
  seo: "SEO",
  hero: "Hero",
  features: "Features",
  portfolio: "Portfolio",
  workflow: "Workflow",
  tutorials: "Tutorials",
  pricing: "Pricing",
  social: "Testimonials",
  faq: "FAQ",
  cta: "CTA",
  footer: "Footer",
};
