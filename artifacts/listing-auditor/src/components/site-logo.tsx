import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

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
  const { platformName, logoUrl, footerLogoUrl } = useBranding();
  const src = variant === "footer" ? footerLogoUrl : logoUrl;

  const footerClass =
    "h-11 sm:h-12 md:h-14 w-auto max-w-[18rem] sm:max-w-[22rem] md:max-w-[26rem] object-contain object-left shrink-0";

  return (
    <span className={cn("inline-flex items-center min-w-0 max-w-full", className)}>
      <img
        src={src}
        alt={platformName}
        width={variant === "footer" ? 280 : 176}
        height={variant === "footer" ? 56 : 32}
        decoding="async"
        className={cn(
          variant === "footer" ? footerClass : imageClassName,
          variant === "app" && "max-w-[9rem]",
        )}
      />
    </span>
  );
}

export function SiteLogoImage({ className = "h-8 w-auto mx-auto mb-5" }: { className?: string }) {
  const { platformName, logoUrl } = useBranding();
  return <img src={logoUrl} alt={platformName} width={176} height={32} decoding="async" className={className} />;
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

  return <img src={logoUrl} alt={platformName} width={144} height={32} decoding="async" className={cn(imageClassName, "shrink-0", className)} />;
}

/** Compact mark for collapsed sidebar (uses uploaded favicon or logo from admin branding). */
export function SiteLogoIcon({
  className,
  imageClassName = "h-8 w-8 object-contain",
}: {
  className?: string;
  imageClassName?: string;
}) {
  const { platformName, faviconUrl } = useBranding();

  return <img src={faviconUrl} alt={platformName} width={32} height={32} decoding="async" className={cn(imageClassName, "shrink-0", className)} />;
}
