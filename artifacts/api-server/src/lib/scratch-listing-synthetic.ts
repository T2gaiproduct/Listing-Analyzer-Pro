import type { Audit, GeneratedContent } from "@workspace/db";
import { PROJECT_ORIGIN_BUILD_BRAND_SCRATCH } from "./audit-project-origin.js";

const SYNTHETIC_BULLET_MARKERS = [
  "designed for everyday use",
  "enthusiasts and professionals",
  "built to last",
  "great value for money",
  "premium quality backed by customer satisfaction",
] as const;

const SYNTHETIC_KEYWORD_FILLER = new Set([
  "premium", "best seller", "top rated", "quality", "durable", "reliable", "easy", "value",
  "professional", "home", "gift", "essential", "popular", "recommended", "trusted",
]);

function normalizeBulletPoints(bullets: string[]): string[] {
  return bullets.map((b) => b.trim()).filter(Boolean);
}

function isSyntheticScratchListingTitle(
  title: string,
  productName: string,
  brandName: string,
  category: string | null | undefined,
): boolean {
  const t = title.trim();
  const name = productName.trim();
  const brand = brandName.trim();
  const cat = category?.trim() ?? "";
  if (!t || !name) return false;
  if (cat && (t === `${name} — ${cat}` || t === `${name} - ${cat}`)) return true;
  if (brand && cat && (t === `${brand} ${name} — ${cat}` || t === `${brand} ${name} - ${cat}`)) {
    return true;
  }
  return false;
}

function isSyntheticScratchListingBullet(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  return SYNTHETIC_BULLET_MARKERS.some((m) => lower.includes(m));
}

export function isSyntheticScratchGeneratedContent(
  gc: GeneratedContent | null | undefined,
  identity: {
    productName: string;
    brandName?: string | null;
    category?: string | null;
  },
): boolean {
  if (!gc) return true;
  const productName = identity.productName?.trim() ?? "";
  const brandName = identity.brandName?.trim() ?? "";
  const category = identity.category?.trim() ?? "";
  const bullets = normalizeBulletPoints(gc.bulletPoints ?? []);
  const title = gc.title?.trim() ?? "";
  const keywords = (gc.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const desc = gc.htmlDescription?.trim() ?? "";

  const bulletsAllSynthetic = bullets.length > 0 && bullets.every(isSyntheticScratchListingBullet);
  const titleSynthetic = title
    ? isSyntheticScratchListingTitle(title, productName, brandName, category)
    : true;
  const mostlyFillerKeywords = keywords.filter((k) => SYNTHETIC_KEYWORD_FILLER.has(k.toLowerCase())).length >= 6;

  const titleLower = title.toLowerCase();
  const bareProductTitle = productName && titleLower === productName.toLowerCase();
  const bareBrandProductTitle = brandName && productName
    && titleLower === `${brandName} ${productName}`.trim().toLowerCase();
  const uploadOnlyTitle = (bareProductTitle || bareBrandProductTitle)
    && bullets.length === 0
    && !desc
    && (keywords.length === 0 || mostlyFillerKeywords);

  if (bulletsAllSynthetic) return true;
  if (uploadOnlyTitle) return true;
  if (titleSynthetic && bullets.length === 0 && !desc && (keywords.length === 0 || mostlyFillerKeywords)) {
    return true;
  }
  return false;
}

export function isBuildBrandScratchAudit(audit: Audit): boolean {
  return audit.projectOrigin?.trim() === PROJECT_ORIGIN_BUILD_BRAND_SCRATCH;
}

export function scratchListingIdentityFromAudit(audit: Audit): {
  productName: string;
  brandName?: string | null;
  category?: string | null;
} {
  return {
    productName: audit.productName?.trim() ?? audit.projectName?.trim() ?? "",
    brandName: audit.brandName,
    category: audit.category,
  };
}