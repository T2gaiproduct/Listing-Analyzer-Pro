import { Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

type SiteLogoVariant = "public" | "app";

function LogoMark({ className, variant = "public" }: { className?: string; variant?: SiteLogoVariant }) {
  if (variant === "app") {
    return (
      <div className={cn("w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0", className)}>
        <Zap className="w-4 h-4 text-white" />
      </div>
    );
  }

  return (
    <div className={cn("w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0", className)}>
      <Search className="w-4 h-4 text-white" />
    </div>
  );
}

interface SiteLogoProps {
  className?: string;
  imageClassName?: string;
  nameClassName?: string;
  showName?: boolean;
  variant?: SiteLogoVariant;
}

export function SiteLogo({
  className,
  imageClassName = "h-8 w-auto max-w-[10rem] object-contain",
  nameClassName,
  showName = true,
  variant = "public",
}: SiteLogoProps) {
  const { platformName, logoUrl, hasCustomLogo } = useBranding();

  if (hasCustomLogo) {
    return (
      <span className={cn("inline-flex items-center min-w-0 max-w-full", className)}>
        <img
          src={logoUrl}
          alt={platformName}
          className={cn(
            "h-8 w-auto max-w-[11rem] sm:max-w-[14rem] object-contain object-left",
            imageClassName,
            "shrink-0",
          )}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 min-w-0 max-w-full flex-nowrap", className)}>
      <LogoMark variant={variant} />
      {showName && <span className={cn("truncate font-bold", nameClassName)}>{platformName}</span>}
    </span>
  );
}

export function SiteLogoImage({ className = "h-8 w-auto mx-auto mb-5" }: { className?: string }) {
  const { platformName, logoUrl } = useBranding();
  return <img src={logoUrl} alt={platformName} className={className} />;
}

export function SiteLogoMark({
  className,
  imageClassName = "h-8 w-auto max-w-[11rem] object-contain",
  variant = "public",
}: {
  className?: string;
  imageClassName?: string;
  variant?: SiteLogoVariant;
}) {
  const { platformName, logoUrl, hasCustomLogo } = useBranding();

  if (hasCustomLogo) {
    return <img src={logoUrl} alt={platformName} className={cn(imageClassName, "shrink-0", className)} />;
  }

  return <LogoMark className={className} variant={variant} />;
}
