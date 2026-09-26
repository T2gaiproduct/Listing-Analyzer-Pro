const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Audit-owned files under /api/images/:auditId/:file (auth required). */
export function isProtectedAuditImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  let path = url.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return false;
    }
  }
  return /^\/api\/images\/\d+\/[^/]+$/.test(path);
}

export function resolveAppImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  return `${basePath}${url.startsWith("/") ? url : `/${url}`}`;
}

/** Fetch protected audit images with session cookies (plain img tags cannot). */
export async function fetchProtectedAppImageBlobUrl(url: string): Promise<string> {
  const fullUrl = resolveAppImageUrl(url);
  const response = await fetch(fullUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Image failed to load (${response.status})`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
