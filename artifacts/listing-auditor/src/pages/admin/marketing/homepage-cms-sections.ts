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
  demo: [
    {
      title: "Interactive demo (Amazon mock)",
      fields: [
        { key: "demo.eyebrow", label: "Eyebrow" },
        { key: "demo.heading", label: "Section heading" },
        { key: "demo.subheading", label: "Section subheading", type: "textarea", rows: 2 },
        { key: "demo.cta_text", label: "CTA button text" },
        { key: "demo.cta_url", label: "CTA button URL", type: "url" },
        { key: "demo.default_price", label: "Default demo price" },
        { key: "demo.default_bullet1", label: "Default bullet 1" },
        { key: "demo.default_bullet2", label: "Default bullet 2" },
        { key: "demo.default_bullet3", label: "Default bullet 3" },
        { key: "demo.default_bullet4", label: "Default bullet 4" },
      ],
    },
    {
      title: "Demo listing 1",
      fields: [
        { key: "demo.listing1_tab", label: "Tab label" },
        { key: "demo.listing1_title", label: "Product title" },
        { key: "demo.listing1_price", label: "Price" },
        { key: "demo.listing1_gallery_indices", label: "Portfolio item indices (e.g. 1,4)" },
        { key: "demo.listing1_aplus_image", label: "A+ image URL (optional)", type: "url" },
        { key: "demo.listing1_bullet1", label: "Bullet 1" },
        { key: "demo.listing1_bullet2", label: "Bullet 2" },
        { key: "demo.listing1_bullet3", label: "Bullet 3" },
        { key: "demo.listing1_bullet4", label: "Bullet 4" },
      ],
    },
    {
      title: "Demo listing 2",
      fields: [
        { key: "demo.listing2_tab", label: "Tab label" },
        { key: "demo.listing2_title", label: "Product title" },
        { key: "demo.listing2_price", label: "Price" },
        { key: "demo.listing2_gallery_indices", label: "Portfolio item indices (e.g. 2,3,5)" },
        { key: "demo.listing2_aplus_image", label: "A+ image URL (optional)", type: "url" },
        { key: "demo.listing2_bullet1", label: "Bullet 1" },
        { key: "demo.listing2_bullet2", label: "Bullet 2" },
        { key: "demo.listing2_bullet3", label: "Bullet 3" },
        { key: "demo.listing2_bullet4", label: "Bullet 4" },
      ],
    },
    {
      title: "Demo listing 3 (optional)",
      fields: [
        { key: "demo.listing3_tab", label: "Tab label" },
        { key: "demo.listing3_title", label: "Product title" },
        { key: "demo.listing3_price", label: "Price" },
        { key: "demo.listing3_gallery_indices", label: "Portfolio item indices" },
        { key: "demo.listing3_aplus_image", label: "A+ image URL (optional)", type: "url" },
        { key: "demo.listing3_bullet1", label: "Bullet 1" },
        { key: "demo.listing3_bullet2", label: "Bullet 2" },
        { key: "demo.listing3_bullet3", label: "Bullet 3" },
        { key: "demo.listing3_bullet4", label: "Bullet 4" },
      ],
    },
  ],
  portfolio: [
    {
      title: "Portfolio section",
      fields: [
        { key: "portfolio.eyebrow", label: "Eyebrow (optional — demo section uses demo.* when set)" },
        { key: "portfolio.heading", label: "Section heading" },
        { key: "portfolio.subheading", label: "Section subheading", type: "textarea", rows: 2 },
        { key: "portfolio.grid_heading", label: "Thumbnail grid heading" },
        { key: "portfolio.cta_text", label: "CTA link text" },
        { key: "portfolio.cta_url", label: "CTA link URL", type: "url" },
      ],
    },
  ],
  transformation: [
    {
      title: "Transformation showcase",
      fields: [
        { key: "transformation.eyebrow", label: "Eyebrow" },
        { key: "transformation.heading", label: "Heading" },
        { key: "transformation.subheading", label: "Subheading", type: "textarea", rows: 2 },
        { key: "transformation.before_label", label: "Before image label" },
        { key: "transformation.before_image", label: "Before image URL", type: "url" },
        { key: "transformation.editorial", label: "Editorial note", type: "textarea", rows: 2 },
        { key: "transformation.cta_text", label: "CTA text" },
        { key: "transformation.cta_url", label: "CTA URL", type: "url" },
        { key: "transformation.output1_label", label: "Output 1 label" },
        { key: "transformation.output1_image", label: "Output 1 image", type: "url" },
        { key: "transformation.output2_label", label: "Output 2 label" },
        { key: "transformation.output2_image", label: "Output 2 image", type: "url" },
        { key: "transformation.output3_label", label: "Output 3 label" },
        { key: "transformation.output3_image", label: "Output 3 image", type: "url" },
        { key: "transformation.output4_label", label: "Output 4 label" },
        { key: "transformation.output4_image", label: "Output 4 image", type: "url" },
        { key: "transformation.output5_label", label: "Output 5 label" },
        { key: "transformation.output5_image", label: "Output 5 image", type: "url" },
        { key: "transformation.output6_label", label: "Output 6 label" },
        { key: "transformation.output6_image", label: "Output 6 image", type: "url" },
        { key: "transformation.output7_label", label: "Output 7 label" },
        { key: "transformation.output7_image", label: "Output 7 image", type: "url" },
        { key: "transformation.output8_label", label: "Output 8 label" },
        { key: "transformation.output8_image", label: "Output 8 image", type: "url" },
      ],
    },
  ],
  workflow: [
    {
      title: "Workflow section",
      fields: [
        { key: "workflow.macro_heading", label: "Macro steps heading" },
        { key: "workflow.macro_step1_label", label: "Macro step 1" },
        { key: "workflow.macro_step2_label", label: "Macro step 2" },
        { key: "workflow.macro_step3_label", label: "Macro step 3" },
        { key: "workflow.heading", label: "Detailed steps heading" },
        { key: "workflow.step1_label", label: "Step 1 label" },
        { key: "workflow.step2_label", label: "Step 2 label" },
        { key: "workflow.step3_label", label: "Step 3 label" },
        { key: "workflow.step4_label", label: "Step 4 label" },
        { key: "workflow.step5_label", label: "Step 5 label" },
        { key: "workflow.step6_label", label: "Step 6 label" },
        { key: "workflow.before_label", label: "Before card label" },
        { key: "workflow.before_score", label: "Before score" },
        { key: "workflow.after_label", label: "After card label" },
        { key: "workflow.after_badge", label: "After badge text" },
        { key: "workflow.after_score", label: "After score" },
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
      title: "Tutorials section (homepage)",
      fields: [
        { key: "tutorials.heading", label: "Section heading" },
        { key: "tutorials.cta_text", label: "View all link text" },
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
  hero: "Hero",
  features: "Features",
  demo: "Interactive demo",
  portfolio: "Portfolio",
  transformation: "Transformation",
  workflow: "Workflow",
  tutorials: "Tutorials",
  cta: "CTA",
  footer: "Footer",
};
