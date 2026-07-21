import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

type SiteLogoVariant = "public" | "app" | "footer";

const wordmarkClass = "h-8 w-auto max-w-[11rem] sm:max-w-[14rem] object-contain object-left shrink-0";

function splitFooterWordmark(name: string): { prefix: string; suffix: string } {
  const trimmed = name.trim();
  if (trimmed.length > 4 && trimmed.toLowerCase().endsWith("lens")) {
    return {
      prefix: trimmed.slice(0, -4),
      suffix: trimmed.slice(-4),
    };
  }
  return { prefix: trimmed, suffix: "" };
}

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
  const { platformName, logoUrl, faviconUrl } = useBranding();

  if (variant === "footer") {
    const { prefix, suffix } = splitFooterWordmark(platformName);
    return (
      <span className={cn("inline-flex items-center gap-2 min-w-0 max-w-full", className)}>
        <img
          src={faviconUrl}
          alt=""
          aria-hidden
          className="h-8 w-8 shrink-0 object-contain"
        />
        <span className="font-bold text-lg tracking-tight leading-none truncate" aria-label={platformName}>
          <span className="text-white">{prefix}</span>
          {suffix ? <span className="text-orange-500">{suffix}</span> : null}
        </span>
      </span>
    );
  }

  const resolvedLogoUrl = logoUrl;

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
