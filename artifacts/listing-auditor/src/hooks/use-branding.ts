import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PLATFORM_NAME,
  defaultFaviconUrl,
  defaultFooterLogoUrl,
  defaultLogoUrl,
  getBasePath,
  resolveBrandingAsset,
  withBrandingCacheBust,
  type SiteBranding,
} from "@/lib/branding";

export function useBranding() {
  const { data, isLoading } = useQuery<SiteBranding>({
    queryKey: ["branding"],
    queryFn: () => fetch(`${getBasePath()}/api/branding`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const platformName = data?.platformName?.trim() || DEFAULT_PLATFORM_NAME;
  const brandingUpdatedAt = data?.brandingUpdatedAt;
  const logoRaw = resolveBrandingAsset(data?.logoUrl, defaultLogoUrl());
  const logoUrl = withBrandingCacheBust(logoRaw, brandingUpdatedAt);
  const footerLogoResolvedRaw = data?.footerLogoUrl?.trim()
    ? resolveBrandingAsset(data.footerLogoUrl, defaultFooterLogoUrl())
    : data?.logoUrl?.trim()
      ? logoRaw
      : resolveBrandingAsset(null, defaultFooterLogoUrl());
  const footerLogoUrl = withBrandingCacheBust(footerLogoResolvedRaw, brandingUpdatedAt);
  const faviconUrl = withBrandingCacheBust(
    resolveBrandingAsset(data?.faviconUrl, defaultFaviconUrl()),
    brandingUpdatedAt,
  );
  const hasCustomLogo = Boolean(data?.logoUrl?.trim());
  const hasCustomFooterLogo = Boolean(data?.footerLogoUrl?.trim());
  const hasCustomFavicon = Boolean(data?.faviconUrl?.trim());

  return {
    platformName,
    logoUrl,
    footerLogoUrl,
    faviconUrl,
    hasCustomLogo,
    hasCustomFooterLogo,
    hasCustomFavicon,
    supportEmail: data?.supportEmail?.trim() ?? "",
    supportPhone: data?.supportPhone?.trim() ?? "",
    companyAddress: data?.companyAddress?.trim() ?? "",
    isLoading,
  };
}
