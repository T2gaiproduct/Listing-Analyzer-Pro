import type { GeneratedContent } from "@workspace/api-client-react";
import {
  generatedContentToListingView,
  type ListingContentView,
} from "@/components/listing-content-card";
import {
  PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
  PROJECT_ORIGIN_BUILD_BRAND_SCRATCH,
  PROJECT_ORIGIN_GRAPHICS_SCRATCH,
} from "@/lib/audit-project-origin";
import {
  graphicsScratchUploadListingHasBaseline,
  isSyntheticScratchListingBullet,
  resolveGraphicsScratchUploadListingBaseline,
} from "@/lib/graphics-scratch-listing-baseline";
import { isShopifyImportAsin } from "@/lib/shopify-import";
import { isWooCommerceImportAsin } from "@/lib/woocommerce-import";
export function listingContentViewHasBaseline(view: ListingContentView | null | undefined): boolean {
  if (!view) return false;
  return Boolean(
    view.title?.trim()
      || (view.bulletPoints?.length ?? 0) > 0
      || (view.keywords?.length ?? 0) > 0
      || view.htmlDescription?.trim(),
  );
}

/** Baseline "current" listing for Build Your Brand scratch compare (upload fields, not placeholders). */
export function resolveScratchBaselineListingContent(input: {
  sourceListingContent?: GeneratedContent | null;
  title?: string | null;
  productName?: string | null;
  brandName?: string | null;
  category?: string | null;
  bulletPoints?: string[] | null;
  targetKeywords?: string[] | null;
  productDescription?: string | null;
  productDetails?: import("@/lib/reference-research").SellerProductDetail[] | null;
}): ListingContentView | null {
  const upload = resolveGraphicsScratchUploadListingBaseline(input);
  if (upload && listingContentViewHasBaseline(upload)) return upload;

  const fromSnapshot = generatedContentToListingView(input.sourceListingContent);
  if (fromSnapshot && listingContentViewHasBaseline(fromSnapshot)) {
    const bullets = fromSnapshot.bulletPoints ?? [];
    if (!bullets.some(isSyntheticScratchListingBullet)) return fromSnapshot;
  }

  return upload;
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

  if (audit?.projectOrigin?.trim() === PROJECT_ORIGIN_GRAPHICS_SCRATCH) {
    return graphicsScratchUploadListingHasBaseline(audit);
  }

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
