type FieldType = "text" | "textarea" | "url" | "select";

export type CmsField = {
  key: string;
  label: string;
  type?: FieldType;
  rows?: number;
  options?: { value: string; label: string }[];
};

export type CmsSection = { title: string; fields: CmsField[] };

export const HOMEPAGE_CMS_SECTIONS: Record<string, CmsSection[]> = {
  trust: [
    {
      title: "Trust marquee",
      fields: [
        { key: "trust.heading", label: "Heading" },
        { key: "trust.subheading", label: "Subheading", type: "textarea", rows: 2 },
      ],
    },
  ],
  tiles: [
    {
      title: "Feature tiles grid",
      fields: [
        { key: "tiles.heading", label: "Section heading" },
        { key: "tiles.subheading", label: "Subheading", type: "textarea", rows: 2 },
        ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [
          { key: `tiles.item${i}_title`, label: `Tile ${i} title` },
          { key: `tiles.item${i}_desc`, label: `Tile ${i} description`, type: "textarea" as const, rows: 2 },
        ]),
      ],
    },
  ],
  personas: [
    {
      title: "Seller personas",
      fields: [
        { key: "personas.heading", label: "Section heading" },
        { key: "personas.subheading", label: "Subheading", type: "textarea", rows: 2 },
        ...[1, 2, 3, 4].flatMap((i) => [
          { key: `personas.item${i}_title`, label: `Persona ${i} title` },
          { key: `personas.item${i}_desc`, label: `Persona ${i} description`, type: "textarea" as const, rows: 3 },
          { key: `personas.item${i}_cta_text`, label: `Persona ${i} CTA text` },
          { key: `personas.item${i}_cta_url`, label: `Persona ${i} CTA URL`, type: "url" as const },
        ]),
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
  features: [],
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
        { key: "workflow.subheading", label: "Subheading", type: "textarea", rows: 2 },
        { key: "workflow.metrics_heading", label: "Outcome metrics heading" },
        { key: "workflow.metric1_value", label: "Metric 1 value" },
        { key: "workflow.metric1_label", label: "Metric 1 label" },
        { key: "workflow.metric2_value", label: "Metric 2 value" },
        { key: "workflow.metric2_label", label: "Metric 2 label" },
        { key: "workflow.metric3_value", label: "Metric 3 value" },
        { key: "workflow.metric3_label", label: "Metric 3 label" },
        { key: "workflow.metric4_value", label: "Metric 4 value" },
        { key: "workflow.metric4_label", label: "Metric 4 label" },
        { key: "workflow.step1_label", label: "Step 1 label" },
        { key: "workflow.step2_label", label: "Step 2 label" },
        { key: "workflow.step3_label", label: "Step 3 label" },
        { key: "workflow.step4_label", label: "Step 4 label" },
        { key: "workflow.step5_label", label: "Step 5 label" },
        { key: "workflow.step6_label", label: "Step 6 label" },
        { key: "workflow.before_label", label: "Before card label (all pairs)" },
        { key: "workflow.after_label", label: "After card label (all pairs)" },
        { key: "workflow.after_badge", label: "After badge text (all pairs)" },
      ],
    },
  ],
  tutorials: [
    {
      title: "Tutorials section (homepage)",
      fields: [
        { key: "tutorials.heading", label: "Section heading" },
        { key: "tutorials.subheading", label: "Section subheading", type: "textarea", rows: 2 },
        { key: "tutorials.cta_text", label: "View all button text" },
        { key: "tutorials.cta_url", label: "View all link URL", type: "url" },
      ],
    },
    {
      title: "Tutorials page (/tutorials)",
      fields: [
        { key: "tutorials_page.heading", label: "Page heading" },
        { key: "tutorials_page.subheading", label: "Page subheading", type: "textarea", rows: 2 },
        { key: "tutorials_page.search_placeholder", label: "Search placeholder" },
        { key: "tutorials_page.cta_heading", label: "Bottom CTA heading" },
        { key: "tutorials_page.cta_subheading", label: "Bottom CTA subheading", type: "textarea", rows: 2 },
        { key: "tutorials_page.cta_primary_text", label: "Primary button text" },
        { key: "tutorials_page.cta_primary_url", label: "Primary button URL", type: "url" },
        { key: "tutorials_page.cta_secondary_text", label: "Secondary button text" },
        { key: "tutorials_page.cta_secondary_url", label: "Secondary button URL", type: "url" },
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
  trust: "Trust",
  tiles: "Tiles",
  personas: "Personas",
  hero: "Hero",
  features: "Features",
  portfolio: "Portfolio",
  workflow: "Workflow",
  tutorials: "Tutorials",
  cta: "CTA",
  footer: "Footer",
};
