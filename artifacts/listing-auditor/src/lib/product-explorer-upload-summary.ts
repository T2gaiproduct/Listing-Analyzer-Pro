import { PROJECT_ORIGIN_GRAPHICS_SCRATCH } from "@/lib/audit-project-origin";
import { isGeneratedListingPreviewImageUrl } from "@/lib/collect-listing-preview-images";

export function isGraphicsScratchProductExplorerAudit(audit: {
  projectOrigin?: string | null;
} | null | undefined): boolean {
  return audit?.projectOrigin?.trim() === PROJECT_ORIGIN_GRAPHICS_SCRATCH;
}

/** Upload / source photos only — exclude AI graphics URLs merged into audit.imageUrls. */
export function filterProductExplorerUploadImageUrls(urls: string[]): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed || isGeneratedListingPreviewImageUrl(trimmed)) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}