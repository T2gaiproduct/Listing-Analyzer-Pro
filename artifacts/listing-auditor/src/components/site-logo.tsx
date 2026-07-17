import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { defaultFooterLogoUrl, resolveBrandingAsset } from "@/lib/branding";

type SiteLogoVariant = "public" | "app" | "footer";

const wordmarkClass = "h-8 w-auto max-w-[11rem] sm:max-w-[14rem] object-contain object-left shrink-0";

interface SiteLogoProps {
  className?: string;
  imageClassName?: string;
  variant?: SiteLogoVariant;
}

export function SiteLogo({
  className,
  imageClassName = wordmarkClass,
  variant = "public",
}: SiteLogoProps) {
  const { platformName, logoUrl, hasCustomLogo } = useBranding();
  const resolvedLogoUrl =
    variant === "footer" && !hasCustomLogo
      ? resolveBrandingAsset(null, defaultFooterLogoUrl())
      : logoUrl;

  return (
    <span className={cn("inline-flex items-center min-w-0 max-w-full", className)}>
      <img src={resolvedLogoUrl} alt={platformName} className={cn(imageClassName, variant === "app" && "max-w-[9rem]")} />
    </span>
  );
}

export function SiteLogoImage({ className = "h-8 w-auto mx-auto mb-5" }: { className?: string }) {
  const { platformName, logoUrl } = useBranding();
  return <img src={logoUrl} alt={platformName} className={className} />;
}

export function SiteLogoMark({
  className,
  imageClassName = "h-8 w-auto max-w-[9rem] object-contain",
}: {
  className?: string;
  imageClassName?: string;
  variant?: SiteLogoVariant;
}) {
  const { platformName, logoUrl } = useBranding();

  return <img src={logoUrl} alt={platformName} className={cn(imageClassName, "shrink-0", className)} />;
}

/** Orange magnifying-glass mark for collapsed sidebar / compact slots. */
export function SiteLogoIcon({
  className,
  imageClassName = "h-8 w-8 object-contain",
}: {
  className?: string;
  imageClassName?: string;
}) {
  const { platformName, faviconUrl } = useBranding();

  return <img src={faviconUrl} alt={platformName} className={cn(imageClassName, "shrink-0", className)} />;
}
