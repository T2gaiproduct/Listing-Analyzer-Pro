export const DEFAULT_PLATFORM_NAME = "Ecommerce Guru";

export interface SiteBranding {
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail?: string;
  supportPhone?: string;
  companyAddress?: string;
}

export function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function defaultLogoUrl() {
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/logo.png`;
  return `${window.location.origin}${basePath}/logo.png`;
}

export function defaultFooterLogoUrl() {
  return defaultLogoUrl();
}

export function defaultFaviconUrl() {
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/logo.png`;
  return `${window.location.origin}${basePath}/logo.png`;
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
