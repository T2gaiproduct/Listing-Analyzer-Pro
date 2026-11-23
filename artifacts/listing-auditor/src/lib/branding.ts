export const DEFAULT_PLATFORM_NAME = "Ecommerce Guru";

/** User-visible product name (admin Platform Name overrides). */
export function platformDisplayName(name?: string | null): string {
  return name?.trim() || DEFAULT_PLATFORM_NAME;
}

export function platformAiName(name?: string | null): string {
  return `${platformDisplayName(name)} AI`;
}

export interface SiteBranding {
  platformName: string;
  logoUrl: string | null;
  footerLogoUrl?: string | null;
  faviconUrl: string | null;
  supportEmail?: string;
  supportPhone?: string;
  companyAddress?: string;
  /** Max settings updated_at for branding keys — cache-bust uploaded logos in footer/header. */
  brandingUpdatedAt?: number;
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
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/logo-footer.svg`;
  return `${window.location.origin}${basePath}/logo-footer.svg`;
}

export function defaultFaviconUrl() {
  const basePath = getBasePath();
  if (typeof window === "undefined") return `${basePath}/logo.png`;
  return `${window.location.origin}${basePath}/logo.png`;
}

/** Absolute URL for a stored branding path (`/api/images/branding/...`) or relative asset. */
export function resolveBrandingAsset(url: string | null | undefined, fallback: string) {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = getBasePath().replace(/\/$/, "");
  let path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (basePath && !path.startsWith(`${basePath}/`)) {
    path = `${basePath}${path}`;
  }
  return `${origin}${path}`;
}

export function withBrandingCacheBust(url: string, brandingUpdatedAt?: number): string {
  if (!brandingUpdatedAt || url.startsWith("data:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${brandingUpdatedAt}`;
}
