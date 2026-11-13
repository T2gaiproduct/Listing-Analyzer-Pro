import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PLATFORM_NAME,
  defaultFaviconUrl,
  defaultFooterLogoUrl,
  defaultLogoUrl,
  getBasePath,
  resolveBrandingAsset,
  type SiteBranding,
} from "@/lib/branding";

export function useBranding() {
  const { data, isLoading } = useQuery<SiteBranding>({
    queryKey: ["branding"],
    queryFn: () => fetch(`${getBasePath()}/api/branding`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const platformName = data?.platformName?.trim() || DEFAULT_PLATFORM_NAME;
  const logoUrl = resolveBrandingAsset(data?.logoUrl, defaultLogoUrl());
  const footerLogoResolved = data?.footerLogoUrl?.trim()
    ? resolveBrandingAsset(data.footerLogoUrl, defaultFooterLogoUrl())
    : data?.logoUrl?.trim()
      ? logoUrl
      : resolveBrandingAsset(null, defaultFooterLogoUrl());
  const faviconUrl = resolveBrandingAsset(data?.faviconUrl, defaultFaviconUrl());
  const hasCustomLogo = Boolean(data?.logoUrl?.trim());
  const hasCustomFooterLogo = Boolean(data?.footerLogoUrl?.trim());
  const hasCustomFavicon = Boolean(data?.faviconUrl?.trim());

  return {
    platformName,
    logoUrl,
    footerLogoUrl: footerLogoResolved,
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
