import type { ImagePromptTemplateCategory, ImagePromptTemplateMetadata } from "@workspace/db";
import { APLUS_AMAZON_MODULE_SEEDS } from "./aplus-amazon-module-seeds.js";

export type ImagePromptTemplateSeed = {
  slug: string;
  category: ImagePromptTemplateCategory;
  name: string;
  description: string;
  enabled: number;
  isSystem: number;
  sortOrder: number;
  promptTemplate: string;
  headlineTemplate?: string | null;
  bodyTemplate?: string | null;
  metadata?: ImagePromptTemplateMetadata | null;
};

export const DEFAULT_IMAGE_PROMPT_TEMPLATE_SEEDS: ImagePromptTemplateSeed[] = [
  {
    slug: "hero",
    category: "graphics",
    name: "Hero Shot",
    description: "White background, product centered",
    enabled: 1,
    isSystem: 1,
    sortOrder: 10,
    metadata: { icon: "🏆", graphicsBucket: "lifestyle" },
    promptTemplate:
      "Amazon main product image for {{productDesc}}. Pure white background, product centered, product taking 80-85% of the canvas. No lifestyle props, no heavy text, no decorative background. Product sharp, clean, and premium. Studio lighting with soft shadows. No logos, no watermarks. No text, no decorative elements.",
  },
  {
    slug: "lifestyle",
    category: "graphics",
    name: "Lifestyle In-Use",
    description: "Product in use, real environment",
    enabled: 1,
    isSystem: 1,
    sortOrder: 20,
    metadata: { icon: "🌅", graphicsBucket: "lifestyle" },
    promptTemplate:
      "Lifestyle product scene for {{productDesc}}. Fully clothed customer in a realistic home or bathroom environment, modest professional e-commerce pose, natural lighting, clean composition. Family-friendly PG commercial photography, SFW. No logos, no watermarks. No text, no decorative elements.",
  },
  {
    slug: "callouts",
    category: "graphics",
    name: "Feature Callouts",
    description: "Numbered features, arrows",
    enabled: 1,
    isSystem: 1,
    sortOrder: 30,
    metadata: { icon: "🔢", graphicsBucket: "feature" },
    promptTemplate:
      "Infographic image for {{productDesc}}. Product in center with numbered feature callouts. Arrows, labels, or pointers. Short benefit-driven text. Clean Amazon-style layout. No logos, no watermarks. Text only for feature callouts, labels, and arrows.",
  },
  {
    slug: "size",
    category: "graphics",
    name: "Size Reference",
    description: "Scale comparison with dimensions",
    enabled: 1,
    isSystem: 1,
    sortOrder: 40,
    metadata: { icon: "📏", graphicsBucket: "feature" },
    promptTemplate:
      "Size reference image for {{productDesc}}. Product scale clearly shown with dimensions. Human hand, table, ruler, or common object for comparison. Easy-to-understand layout. No logos, no watermarks. Dimension text and scale labels are allowed.",
  },
  {
    slug: "beforeafter",
    category: "graphics",
    name: "Before / After",
    description: "Transformation comparison",
    enabled: 1,
    isSystem: 1,
    sortOrder: 50,
    metadata: { icon: "⚡", graphicsBucket: "feature" },
    promptTemplate:
      'Before/after transformation image for {{productDesc}}. Clear left-right comparison with "Before" and "After" labels. Product benefit or transformation shown. Clean and credible design. No logos, no watermarks. "Before" and "After" labels are allowed.',
  },
  {
    slug: "bundle",
    category: "graphics",
    name: "Bundle Shot",
    description: "All included items",
    enabled: 1,
    isSystem: 1,
    sortOrder: 60,
    metadata: { icon: "📦", graphicsBucket: "lifestyle" },
    promptTemplate:
      "Bundle shot image for {{productDesc}}. Main product with accessories or included items. Labels if needed. Clean product arrangement. Premium e-commerce look. No logos, no watermarks. Product labels and item names are allowed.",
  },
  {
    slug: "social",
    category: "graphics",
    name: "Social Proof",
    description: "Ratings & reviews",
    enabled: 1,
    isSystem: 1,
    sortOrder: 70,
    metadata: { icon: "⭐", graphicsBucket: "feature" },
    promptTemplate:
      "Social proof image for {{productDesc}}. Star rating style, short review-style highlight, product visible. Clean and trustworthy layout. No logos, no watermarks. Star ratings and short review text are allowed. Avoid fake customer names or fake review claims.",
  },
  {
    slug: "custom",
    category: "graphics",
    name: "Generate Custom",
    description: "Custom prompt from the user",
    enabled: 1,
    isSystem: 1,
    sortOrder: 80,
    metadata: { icon: "✨", graphicsBucket: "lifestyle" },
    promptTemplate:
      "Custom creative product image for {{productDesc}}. Interpret any seller creative direction as refinements on this brief. Professional commercial product photography. High-resolution, clean e-commerce quality. No logos, no watermarks unless the seller direction explicitly allows on-image text.",
  },
  ...APLUS_AMAZON_MODULE_SEEDS,
];
