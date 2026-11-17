/** Browser-safe URLs for graphics project upload/source files (not generated outputs). */

export function graphicsSourceFilename(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  return withoutQuery.split("/").pop() ?? null;
}

export function toGraphicsSourcePublicUrl(projectId: number, raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/api/images/")) return trimmed;
  const filename = graphicsSourceFilename(trimmed);
  if (!filename) return null;
  return `/api/images/graphics/${projectId}/${encodeURIComponent(filename)}`;
}

export function toGraphicsSourcePublicUrls(
  projectId: number,
  urls: string[] | null | undefined,
): string[] {
  const out: string[] = [];
  for (const raw of urls ?? []) {
    const resolved = toGraphicsSourcePublicUrl(projectId, raw);
    if (resolved && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}

export function repairProductExplorerImageUrl(projectId: number | null | undefined, raw: string): string {
  if (projectId != null && projectId > 0) {
    const asPublic = toGraphicsSourcePublicUrl(projectId, raw);
    if (asPublic) return asPublic;
  }
  return raw.trim();
}