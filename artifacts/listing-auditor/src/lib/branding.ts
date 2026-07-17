export const DEFAULT_PLATFORM_NAME = "SellerLens";

export interface SiteBranding {
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function defaultLogoUrl() {
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/logo.svg`;
  return `${window.location.origin}${basePath}/logo.svg`;
}

export function defaultFaviconUrl() {
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/favicon.svg`;
  return `${window.location.origin}${basePath}/favicon.svg`;
}

export function resolveBrandingAsset(url: string | null | undefined, fallback: string) {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = getBasePath();
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  return `${origin}${basePath}/${trimmed}`;
}
