import type { AuditResult } from "@workspace/db";

export interface ProductSuggestionInput {
  productName: string;
  title?: string | null;
  brandName?: string | null;
  category?: string | null;
  bulletPoints?: string[] | null;
  generatedContent?: {
    title?: string;
    bulletPoints?: string[];
    keywords?: string[];
  } | null;
  targetKeywords?: string[] | null;
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedImages?: {
    main?: string[];
    infographic?: string[];
    lifestyle?: string[];
  } | null;
  currentStep?: number | null;
  status?: string | null;
  overallScore?: number | null;
  result?: AuditResult | null;
  competitorCount?: number;
}

function countImages(input: ProductSuggestionInput): number {
  const urls = new Set<string>();
  for (const u of input.imageUrls ?? []) {
    if (u?.trim()) urls.add(u.trim());
  }
  for (const rec of input.imageRecords ?? []) {
    if (rec?.currentUrl?.trim()) urls.add(rec.currentUrl.trim());
  }
  const g = input.generatedImages;
  if (g) {
    for (const u of [...(g.main ?? []), ...(g.lifestyle ?? []), ...(g.infographic ?? [])]) {
      if (u?.trim()) urls.add(u.trim());
    }
  }
  return urls.size;
}

function hasGeneratedMainImage(input: ProductSuggestionInput): boolean {
  return (input.generatedImages?.main ?? []).some((u) => u?.trim());
}

/** Build actionable AI suggestions from audit/listing data (no live LLM call). */
export function buildProductSuggestions(input: ProductSuggestionInput): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  const add = (text: string) => {
    const normalized = text.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    suggestions.push(normalized);
  };

  const result = input.result;
  if (result) {
    for (const section of [
      result.titleScore,
      result.bulletScore,
      result.imageScore,
      result.keywordScore,
    ]) {
      for (const s of section?.suggestions ?? []) add(s);
      for (const issue of section?.issues ?? []) add(issue);
    }
  }

  const listingTitle = (
    input.generatedContent?.title
    ?? input.title
    ?? input.productName
    ?? ""
  ).toLowerCase();

  const keywords = [
    ...(input.generatedContent?.keywords ?? []),
    ...(input.targetKeywords ?? []),
  ]
    .map((k) => k.trim())
    .filter((k) => k.length > 2);

  const uniqueKeywords = [...new Set(keywords.map((k) => k.toLowerCase()))];

  const missingInTitle = uniqueKeywords.filter((kw) => !listingTitle.includes(kw));
  if (missingInTitle.length > 0) {
    const top = keywords.find((k) => k.toLowerCase() === missingInTitle[0]) ?? missingInTitle[0];
    add(`Title is missing high-volume keyword '${top}'`);
  }

  const bullets = (input.generatedContent?.bulletPoints ?? input.bulletPoints ?? [])
    .map((b) => b.trim())
    .filter(Boolean);

  if (bullets.length < 5) {
    const need = 5 - bullets.length;
    add(`Add ${need} more bullet point${need === 1 ? "" : "s"} to reach Amazon's 5-bullet standard`);
  }

  const imageCount = countImages(input);
  if (imageCount === 0) {
    add("Upload at least one product image — marketplaces require a main hero image");
  } else {
    if (imageCount < 7) {
      add(`Add ${7 - imageCount} more listing images — top sellers use 7+ visuals`);
    }
    if (!hasGeneratedMainImage(input)) {
      add("Main image missing white background — Flipkart may suppress non-compliant hero shots");
    }
  }

  if (!input.generatedContent?.title && !input.generatedContent?.bulletPoints?.length) {
    add("Run AI listing generation in Build Your Brand to optimize title, bullets, and keywords");
  }

  if (!input.brandName?.trim()) {
    add("Add a brand name to improve catalog matching and customer trust");
  }

  if (!input.category?.trim()) {
    add("Set a product category so AI can tailor keywords and compliance checks");
  }

  const step = input.currentStep ?? 1;
  if (step < 2) {
    add("Complete the Listing step to generate SEO-optimized copy for this product");
  } else if (step < 3) {
    add("Generate lifestyle and infographic images in the Graphics step");
  } else if (step < 5 && input.status !== "complete") {
    add("Export your listing to Amazon, Shopify, or Flipkart from the workflow");
  }

  if ((input.competitorCount ?? 0) === 0) {
    add("Add competitor ASINs to uncover keyword and positioning gaps");
  }

  if ((input.overallScore ?? 0) > 0 && (input.overallScore ?? 0) < 70) {
    add(`Listing score is ${input.overallScore}/100 — address title, bullets, and images to lift conversion`);
  }

  if (suggestions.length === 0) {
    add("Your listing looks strong. Export to your marketplaces or refresh content to stay competitive");
  }

  return suggestions.slice(0, 6);
}
