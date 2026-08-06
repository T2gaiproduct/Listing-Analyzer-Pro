import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const LOGO_FILES: Record<string, string> = {
  Amazon: "amazon.svg",
  Shopify: "shopify.svg",
  Flipkart: "flipkart.svg",
  WooCommerce: "woocommerce.svg",
  Meesho: "meesho.svg",
  Shopsy: "shopsy.svg",
};

function MarketplaceImage({ marketplace, className }: { marketplace: string; className?: string }) {
  const file = LOGO_FILES[marketplace];
  if (!file) {
    return (
      <span className={cn("text-[11px] font-semibold text-slate-700", className)}>
        {marketplace}
      </span>
    );
  }
  return (
    <img
      src={`${basePath}/marketplace/${file}`}
      alt={marketplace}
      className={cn("h-full w-auto max-w-full object-contain object-left", className)}
    />
  );
}

const cardClass =
  "flex flex-1 min-w-0 basis-0 sm:flex-none sm:w-28 items-center justify-center h-9 sm:h-14 px-0.5 sm:px-3 bg-transparent";
const logoBoxClass = "flex items-center justify-center w-full h-4 sm:h-7 overflow-hidden";

const LOGO_CARD_CLASS: Partial<Record<string, string>> = {
  WooCommerce: "sm:w-36",
};

const LOGO_IMAGE_CLASS: Partial<Record<string, string>> = {
  WooCommerce: "scale-[1.1] sm:scale-[1.2] origin-left",
};

type MarketplaceEntry = {
  name: string;
  cardClass?: string;
  logoBoxClass?: string;
  render: (className?: string) => ReactNode;
};

const marketplaces: MarketplaceEntry[] = [
  "Amazon",
  "Shopify",
  "WooCommerce",
].map((name) => ({
  name,
  logoBoxClass: name === "WooCommerce" ? "overflow-visible" : undefined,
  cardClass: LOGO_CARD_CLASS[name],
  render: (className?: string) => (
    <MarketplaceImage
      marketplace={name}
      className={cn(LOGO_IMAGE_CLASS[name], className)}
    />
  ),
}));

function LogoCard({ item, pill }: { item: MarketplaceEntry; pill?: boolean }) {
  return (
    <div
      className={cn(
        pill
          ? "flex items-center justify-center h-11 min-w-[7.5rem] px-4 bg-transparent"
          : cn(cardClass, item.cardClass),
      )}
      title={item.name}
    >
      <div className={cn(logoBoxClass, item.logoBoxClass, pill && "h-5 w-24")}>
        {item.render()}
      </div>
      <span className="sr-only">{item.name}</span>
    </div>
  );
}

export function MarketplaceLogo({
  marketplace,
  className,
}: {
  marketplace: string;
  className?: string;
}) {
  return (
    <div className={cn("h-5 w-28 flex items-center", className)}>
      <MarketplaceImage
        marketplace={marketplace}
        className={cn("max-h-5", LOGO_IMAGE_CLASS[marketplace])}
      />
    </div>
  );
}

export function MarketplaceLogos({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "pill";
}) {
  const pill = variant === "pill";

  return (
    <div
      className={cn(
        "flex flex-nowrap items-center justify-center gap-3 w-full",
        pill ? "flex-wrap" : "sm:justify-start gap-1 sm:gap-3",
        className,
      )}
    >
      {marketplaces.map((item) => (
        <LogoCard key={item.name} item={item} pill={pill} />
      ))}
    </div>
  );
}
