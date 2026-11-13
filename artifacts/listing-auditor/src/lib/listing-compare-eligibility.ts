import type { GeneratedContent } from "@workspace/api-client-react";
import {
  generatedContentToListingView,
  type ListingContentView,
} from "@/components/listing-content-card";
import {
  PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
  PROJECT_ORIGIN_BUILD_BRAND_SCRATCH,
} from "@/lib/audit-project-origin";
import { isShopifyImportAsin } from "@/lib/shopify-import";
import { isWooCommerceImportAsin } from "@/lib/woocommerce-import";
import { normalizeBulletPoints } from "@/lib/listing-content-format";

export function listingContentViewHasBaseline(view: ListingContentView | null | undefined): boolean {
  if (!view) return false;
  return Boolean(
    view.title?.trim()
      || (view.bulletPoints?.length ?? 0) > 0
      || (view.keywords?.length ?? 0) > 0
      || view.htmlDescription?.trim(),
  );
}

/** Baseline "current" listing for Build Your Brand scratch compare (prefers frozen source snapshot). */
export function resolveScratchBaselineListingContent(input: {
  sourceListingContent?: GeneratedContent | null;
  title?: string | null;
  productName?: string | null;
  bulletPoints?: string[] | null;
  targetKeywords?: string[] | null;
  productDescription?: string | null;
}): ListingContentView | null {
  const fromSnapshot = generatedContentToListingView(input.sourceListingContent);
  if (listingContentViewHasBaseline(fromSnapshot)) return fromSnapshot;

  const title = String(input.title ?? input.productName ?? "").trim();
  if (!title) return null;

  const desc = input.productDescription?.trim() ?? "";
  return {
    title,
    bulletPoints: normalizeBulletPoints(input.bulletPoints ?? []),
    keywords: (input.targetKeywords ?? []).map(String).filter(Boolean),
    htmlDescription: desc ? `<p>${desc.replace(/\n/g, "<br/>")}</p>` : "",
  };
}

export function shouldShowExistingListingContent(
  product?: {
    isShopifyImport?: boolean | null;
    isWooCommerceImport?: boolean | null;
    listingTitle?: string | null;
    title?: string | null;
    name?: string | null;
  } | null,
  audit?: {
    asin?: string | null;
    title?: string | null;
    productName?: string | null;
    bulletPoints?: string[] | null;
    targetKeywords?: string[] | null;
    productDescription?: string | null;
    sourceListingContent?: GeneratedContent | null;
    projectOrigin?: string | null;
  } | null,
): boolean {
  if (product?.isShopifyImport || product?.isWooCommerceImport) return true;

  const asin = audit?.asin?.trim();
  if (asin && !isShopifyImportAsin(asin) && !isWooCommerceImportAsin(asin)) {
    return true;
  }

  const origin = audit?.projectOrigin?.trim();
  const isBuildBrand =
    origin === PROJECT_ORIGIN_BUILD_BRAND_SCRATCH || origin === PROJECT_ORIGIN_BUILD_BRAND_IMPORT;

  const snapshotView = generatedContentToListingView(audit?.sourceListingContent);
  if (listingContentViewHasBaseline(snapshotView)) return true;

  if (isBuildBrand) {
    const baseline = resolveScratchBaselineListingContent({
      sourceListingContent: audit?.sourceListingContent,
      title: audit?.title,
      productName: audit?.productName,
      bulletPoints: audit?.bulletPoints as string[] | undefined,
      targetKeywords: audit?.targetKeywords as string[] | undefined,
      productDescription: audit?.productDescription,
    });
    if (listingContentViewHasBaseline(baseline)) return true;

    const title =
      audit?.title?.trim()
      || audit?.productName?.trim()
      || product?.listingTitle?.trim()
      || product?.title?.trim()
      || product?.name?.trim();
    return Boolean(title);
  }

  return false;
}
