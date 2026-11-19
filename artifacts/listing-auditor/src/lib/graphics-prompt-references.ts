const MAX_REFERENCE_IMAGES = 4;

function normalizeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_REFERENCE_IMAGES) break;
  }
  return out;
}

/**
 * Per-type Customize references win; otherwise use brand logo (if any) + Upload step product photos.
 */
export function resolveGraphicsPromptReferenceImageUrls(
  perTypeReferenceImages: string[],
  uploadFallbackUrls: string[],
  brandLogoUrl?: string | null,
): string[] | undefined {
  const fromCustomize = normalizeUrls(perTypeReferenceImages);
  if (fromCustomize.length > 0) return fromCustomize;
  const logo = brandLogoUrl?.trim();
  const pool = logo ? [logo, ...uploadFallbackUrls] : uploadFallbackUrls;
  const fromUpload = normalizeUrls(pool);
  return fromUpload.length > 0 ? fromUpload : undefined;
}