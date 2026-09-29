import { AMAZON_LISTING_AI_INSTRUCTIONS } from "./amazon-listing-instructions.js";
import type { ContentMarketplaceRules } from "@workspace/db";

export type ContentMarketplaceSeed = {
  slug: string;
  name: string;
  description: string;
  enabled: number;
  isDefault: number;
  sortOrder: number;
  aiInstructions: string;
  rules?: ContentMarketplaceRules;
};

const GENERIC_JSON_RULES = `Follow the marketplace's character limits, formatting, and compliance rules in the instructions above.`;

function genericInstructions(marketplaceName: string, focus: string): string {
  return `You are an expert ${marketplaceName} listing copywriter and SEO specialist.

${focus}

${GENERIC_JSON_RULES}

Title: clear, keyword-rich, within platform limits.
Bullet points: benefit-led, scannable, plain text (no HTML in bullets unless the platform requires otherwise).
Keywords: relevant search terms appropriate for ${marketplaceName}.
HTML description: clean semantic HTML using only <h2>, <h3>, <p>, <strong>, <ul>, <li>, <br> unless the platform forbids HTML — then use plain text paragraphs.

Avoid unverifiable claims, prohibited promotional language, and policy violations for ${marketplaceName}.`;
}

export const DEFAULT_CONTENT_MARKETPLACE_SEEDS: ContentMarketplaceSeed[] = [
  {
    slug: "amazon",
    name: "Amazon",
    description: "Amazon product detail page listing content",
    enabled: 1,
    isDefault: 1,
    sortOrder: 10,
    aiInstructions: AMAZON_LISTING_AI_INSTRUCTIONS,
    rules: {
      titleMinChars: 150,
      titleMaxChars: 200,
      bulletCount: 5,
      bulletMinChars: 180,
      bulletMaxChars: 250,
      keywordCount: 10,
      descriptionMinWords: 400,
      descriptionMaxWords: 600,
      requiredFields: ["title", "bulletPoints", "keywords", "htmlDescription"],
    },
  },
  {
    slug: "ebay",
    name: "eBay",
    description: "eBay fixed-price listing content",
    enabled: 1,
    isDefault: 0,
    sortOrder: 20,
    aiInstructions: genericInstructions(
      "eBay",
      "Optimize titles for eBay Cassini search (clear item specifics, brand/model when known). Use buyer-friendly tone. Respect eBay title length (typically 80 characters for many categories — stay concise unless category allows more).",
    ),
    rules: { titleMaxChars: 80, bulletCount: 5, keywordCount: 10 },
  },
  {
    slug: "shopify",
    name: "Shopify",
    description: "Shopify Online Store product content",
    enabled: 1,
    isDefault: 0,
    sortOrder: 30,
    aiInstructions: genericInstructions(
      "Shopify",
      "Write for a direct-to-consumer Shopify product page: brand voice, scannable bullets, SEO title and meta-friendly keywords. Description can be richer HTML for storytelling.",
    ),
    rules: { bulletCount: 5, keywordCount: 10 },
  },
  {
    slug: "woocommerce",
    name: "WooCommerce",
    description: "WooCommerce product listing content",
    enabled: 1,
    isDefault: 0,
    sortOrder: 40,
    aiInstructions: genericInstructions(
      "WooCommerce",
      "Write WordPress/WooCommerce-friendly product copy with clear short description bullets and a longer HTML description suitable for the product tab.",
    ),
    rules: { bulletCount: 5, keywordCount: 10 },
  },
  {
    slug: "walmart",
    name: "Walmart",
    description: "Walmart Marketplace listing content",
    enabled: 1,
    isDefault: 0,
    sortOrder: 50,
    aiInstructions: genericInstructions(
      "Walmart Marketplace",
      "Follow Walmart Marketplace content policies: factual claims, no prohibited phrases, clear product title and key features for Walmart search.",
    ),
    rules: { titleMaxChars: 200, bulletCount: 5, keywordCount: 10 },
  },
  {
    slug: "etsy",
    name: "Etsy",
    description: "Etsy handmade and vintage listings",
    enabled: 1,
    isDefault: 0,
    sortOrder: 60,
    aiInstructions: genericInstructions(
      "Etsy",
      "Emphasize craftsmanship, materials, personalization, and giftability. Titles should include what it is, who it is for, and style. Avoid mass-market keyword stuffing.",
    ),
    rules: { titleMaxChars: 140, keywordCount: 13 },
  },
  {
    slug: "other",
    name: "Other marketplaces",
    description: "Generic marketplace listing guidelines",
    enabled: 1,
    isDefault: 0,
    sortOrder: 100,
    aiInstructions: genericInstructions(
      "online marketplace",
      "Apply general e-commerce best practices for titles, bullets, keywords, and product descriptions. Adapt tone to the product category.",
    ),
    rules: { bulletCount: 5, keywordCount: 10 },
  },
];
