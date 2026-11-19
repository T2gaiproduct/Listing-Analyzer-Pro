import type { GeneratedContent } from "@workspace/api-client-react";
import {
  generatedContentToListingView,
  type ListingContentView,
} from "@/components/listing-content-card";
import { isGraphicsAplusShellAudit } from "@workspace/graphics-aplus-audit";
import { normalizeBulletPoints } from "@/lib/listing-content-format";
import type { SellerProductDetail } from "@/lib/reference-research";
import {
  resolveAiSnapshot,
  type ContentVariantWithMeta,
} from "@/lib/listing-content-field-merge";

function listingViewHasBaseline(view: ListingContentView | null | undefined): boolean {
  if (!view) return false;
  return Boolean(
    view.title?.trim()
      || (view.bulletPoints?.length ?? 0) > 0
      || (view.keywords?.length ?? 0) > 0
      || view.htmlDescription?.trim(),
  );
}

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

export function isSyntheticScratchListingTitle(
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

export function isSyntheticScratchListingBullet(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  return SYNTHETIC_BULLET_MARKERS.some((m) => lower.includes(m));
}

export type ScratchListingIdentity = {
  productName: string;
  brandName?: string | null;
  category?: string | null;
};

/** True when listing copy is only upload placeholders — not AI-optimized output. */
export function isSyntheticScratchGeneratedContent(
  gc: GeneratedContent | null | undefined,
  identity: ScratchListingIdentity,
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

  if (bulletsAllSynthetic) return true;
  if (titleSynthetic && bullets.length === 0 && !desc && (keywords.length === 0 || mostlyFillerKeywords)) {
    return true;
  }
  return false;
}

function uploadListingAttributes(
  productDetails?: SellerProductDetail[] | null,
): ListingContentView["attributes"] {
  const rows = (productDetails ?? [])
    .map((row) => ({
      attribute: row.attribute?.trim() ?? "",
      value: row.value?.trim() ?? "",
    }))
    .filter((row) => row.attribute && row.value);
  return rows.length > 0 ? rows : undefined;
}

function uploadListingTitle(
  audit: {
    title?: string | null;
    productName?: string | null;
    brandName?: string | null;
    category?: string | null;
  },
): string {
  const productName = audit.productName?.trim() ?? "";
  const brand = audit.brandName?.trim() ?? "";
  const rawTitle = audit.title?.trim() ?? "";
  if (rawTitle && !isSyntheticScratchListingTitle(rawTitle, productName, brand, audit.category)) {
    return rawTitle;
  }
  if (brand && productName) return `${brand} ${productName}`;
  return productName;
}

function uploadListingBullets(audit: { bulletPoints?: string[] | null }): string[] {
  const raw = normalizeBulletPoints(audit.bulletPoints ?? []);
  return raw.filter((b) => !isSyntheticScratchListingBullet(b));
}

function uploadListingKeywords(
  audit: { targetKeywords?: string[] | null; productName?: string | null; category?: string | null },
  bullets: string[],
): string[] {
  const raw = (audit.targetKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (raw.length === 0) return [];
  const productTokens = new Set(
    [...(audit.productName?.split(/\s+/) ?? []), ...(audit.category?.split(/\s+/) ?? [])]
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2),
  );
  const mostlyFiller = raw.filter((k) => SYNTHETIC_KEYWORD_FILLER.has(k.toLowerCase())).length >= 6;
  if (mostlyFiller && bullets.length === 0) return [];
  return raw.filter((k) => !SYNTHETIC_KEYWORD_FILLER.has(k.toLowerCase()) || productTokens.has(k.toLowerCase()));
}

function uploadListingDescription(audit: { productDescription?: string | null }): string {
  const desc = audit.productDescription?.trim() ?? "";
  if (!desc || isGraphicsAplusShellAudit({ productDescription: desc })) return "";
  const escaped = desc
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
}

/** Optimize Listing "Current" for scratch flows — upload fields only, no auto placeholders. */
export function resolveGraphicsScratchUploadListingBaseline(audit: {
  title?: string | null;
  productName?: string | null;
  brandName?: string | null;
  category?: string | null;
  bulletPoints?: string[] | null;
  targetKeywords?: string[] | null;
  productDescription?: string | null;
  productDetails?: SellerProductDetail[] | null;
} | null | undefined): ListingContentView | null {
  if (!audit) return null;
  const title = uploadListingTitle(audit);
  const bulletPoints = uploadListingBullets(audit);
  const keywords = uploadListingKeywords(audit, bulletPoints);
  const htmlDescription = uploadListingDescription(audit);
  const category = audit.category?.trim() || null;
  const attributes = uploadListingAttributes(audit.productDetails);

  if (!title && bulletPoints.length === 0 && keywords.length === 0 && !htmlDescription && !attributes?.length) {
    return null;
  }

  return {
    title,
    bulletPoints,
    keywords,
    htmlDescription,
    category,
    attributes,
  };
}

export function graphicsScratchUploadListingHasBaseline(
  audit: Parameters<typeof resolveGraphicsScratchUploadListingBaseline>[0],
): boolean {
  return listingViewHasBaseline(resolveGraphicsScratchUploadListingBaseline(audit));
}

export function graphicsScratchUploadListingSnapshot(
  audit: Parameters<typeof resolveGraphicsScratchUploadListingBaseline>[0],
): GeneratedContent | undefined {
  const view = resolveGraphicsScratchUploadListingBaseline(audit);
  if (!view) return undefined;
  const gc: GeneratedContent = {
    title: view.title,
    bulletPoints: view.bulletPoints,
    keywords: view.keywords,
    htmlDescription: view.htmlDescription,
  };
  return gc;
}

/** Prefer upload baseline over frozen synthetic snapshot on graphics_scratch audits. */
export function resolveGraphicsScratchExistingForCompare(
  audit: {
    projectOrigin?: string | null;
    sourceListingContent?: GeneratedContent | null;
    title?: string | null;
    productName?: string | null;
    brandName?: string | null;
    category?: string | null;
    bulletPoints?: string[] | null;
    targetKeywords?: string[] | null;
    productDescription?: string | null;
  } | null | undefined,
): ListingContentView | null {
  const upload = resolveGraphicsScratchUploadListingBaseline(audit);
  if (upload && listingViewHasBaseline(upload)) return upload;
  const snap = generatedContentToListingView(audit?.sourceListingContent);
  if (!snap) return upload;
  const productName = audit?.productName?.trim() ?? "";
  if (
    isSyntheticScratchListingTitle(snap.title, productName, audit?.brandName ?? "", audit?.category)
    || snap.bulletPoints.some(isSyntheticScratchListingBullet)
  ) {
    return upload;
  }
  return snap;
}

/** Saved marketplace copy counts as optimized only when AI output is present (not upload placeholders). */
export function auditContentVariantHasOptimizedListing(
  variant: ContentVariantWithMeta | null | undefined,
  identity: ScratchListingIdentity,
): boolean {
  if (!variant) return false;
  const ai = resolveAiSnapshot(variant);
  if (isSyntheticScratchGeneratedContent(ai, identity)) return false;
  return Boolean(
    ai.title?.trim()
      || ai.bulletPoints?.some((b) => b.trim())
      || ai.keywords?.some((k) => k.trim())
      || ai.htmlDescription?.trim()
      || (ai.attributes?.length ?? 0) > 0,
  );
}