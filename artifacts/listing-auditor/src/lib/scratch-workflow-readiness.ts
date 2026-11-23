import type { GeneratedContent } from "@workspace/api-client-react";
import { collectListingPreviewImages } from "@/lib/collect-listing-preview-images";
import {
  auditContentVariantHasOptimizedListing,
  isSyntheticScratchGeneratedContent,
  type ScratchListingIdentity,
} from "@/lib/graphics-scratch-listing-baseline";
import type { ContentVariantRow } from "@/components/listing-marketplace-content-panel";
import type { ContentVariantWithMeta } from "@/lib/listing-content-field-merge";

type GraphicsImageRecord = {
  type?: string;
  currentUrl?: string;
};

/** True when scratch workflow has saved AI listing (not upload placeholders). */
export function workflowHasOptimizedScratchListing(
  generatedContent: GeneratedContent | null,
  contentVariants: ContentVariantRow[],
  identity: ScratchListingIdentity,
): boolean {
  if (
    generatedContent
    && !isSyntheticScratchGeneratedContent(generatedContent, identity)
    && (
      generatedContent.title?.trim()
      || generatedContent.bulletPoints?.some((b) => b.trim())
      || generatedContent.htmlDescription?.trim()
    )
  ) {
    return true;
  }
  return contentVariants.some((v) => auditContentVariantHasOptimizedListing(
    v.generatedContent as ContentVariantWithMeta,
    identity,
  ));
}

export function workflowHasGeneratedScratchImages(opts: {
  imageRecords?: GraphicsImageRecord[] | null;
  generatedImages?: unknown;
  graphicsProjectRecords?: GraphicsImageRecord[] | null;
}): boolean {
  return collectListingPreviewImages({
    imageRecords: opts.imageRecords,
    generatedImages: opts.generatedImages,
    graphicsProjectRecords: opts.graphicsProjectRecords,
    generatedOnly: true,
  }).length > 0;
}

/** Listing Preview + Export steps: AI copy and generated graphics only. */
export function scratchWorkflowReadyForPreviewExport(
  generatedContent: GeneratedContent | null,
  contentVariants: ContentVariantRow[],
  identity: ScratchListingIdentity,
  images: Parameters<typeof workflowHasGeneratedScratchImages>[0],
): boolean {
  return workflowHasOptimizedScratchListing(generatedContent, contentVariants, identity)
    && workflowHasGeneratedScratchImages(images);
}