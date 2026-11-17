import type { GeneratedContent } from "@workspace/api-client-react";
import {
  generatedContentToListingView,
  type ListingContentView,
} from "@/components/listing-content-card";
import { isGraphicsAplusShellDescription } from "@workspace/graphics-aplus-audit";
import { normalizeBulletPoints } from "@/lib/listing-content-format";

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
  if (!desc || isGraphicsAplusShellDescription({ productDescription: desc })) return "";
  const escaped = desc
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
}

/** Optimize Listing "Current" for Create Graphics scratch — upload fields only, no auto placeholders. */
export function resolveGraphicsScratchUploadListingBaseline(audit: {
  title?: string | null;
  productName?: string | null;
  brandName?: string | null;
  category?: string | null;
  bulletPoints?: string[] | null;
  targetKeywords?: string[] | null;
  productDescription?: string | null;
} | null | undefined): ListingContentView | null {
  if (!audit) return null;
  const title = uploadListingTitle(audit);
  const bulletPoints = uploadListingBullets(audit);
  const keywords = uploadListingKeywords(audit, bulletPoints);
  const htmlDescription = uploadListingDescription(audit);
  const category = audit.category?.trim() || null;

  if (!title && bulletPoints.length === 0 && keywords.length === 0 && !htmlDescription) {
    return null;
  }

  return {
    title,
    bulletPoints,
    keywords,
    htmlDescription,
    category,
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