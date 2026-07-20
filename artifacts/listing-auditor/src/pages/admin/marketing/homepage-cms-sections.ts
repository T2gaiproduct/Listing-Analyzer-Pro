type FieldType = "text" | "textarea" | "url" | "select";

export type CmsField = {
  key: string;
  label: string;
  type?: FieldType;
  rows?: number;
  options?: { value: string; label: string }[];
};

export type CmsSection = { title: string; fields: CmsField[] };

function featureItemFields(index: number): CmsField[] {
  return [
    { key: `features.item${index}_title`, label: `Feature ${index} title` },
    { key: `features.item${index}_desc`, label: `Feature ${index} description`, type: "textarea" },
    { key: `features.item${index}_href`, label: `Feature ${index} link URL`, type: "url" },
  ];
}

export const HOMEPAGE_CMS_SECTIONS: Record<string, CmsSection[]> = {
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
      title: "Hero stats (shown below all slides)",
      fields: [
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
  promo: "Promo",
  nav: "Navigation",
  seo: "SEO",
  hero: "Hero",
  features: "Features",
  portfolio: "Portfolio",
  workflow: "Workflow",
  tutorials: "Tutorials",
  cta: "CTA",
  footer: "Footer",
};
