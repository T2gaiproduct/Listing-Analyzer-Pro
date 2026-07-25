import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const cardClass =
  "flex flex-1 min-w-0 basis-0 sm:flex-none sm:w-28 items-center justify-center h-9 sm:h-14 px-0.5 sm:px-3 bg-transparent";
const logoBoxClass = "flex items-center justify-center w-full h-4 sm:h-7 overflow-hidden";

function AmazonLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${basePath}/marketplace/amazon.svg`}
      alt=""
      className={cn("h-full w-auto max-w-full object-contain", className)}
      aria-hidden
    />
  );
}

function ShopifyLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${basePath}/marketplace/shopify.svg`}
      alt=""
      className={cn("h-full w-auto max-w-full object-contain", className)}
      aria-hidden
    />
  );
}

type MarketplaceEntry = {
  name: string;
  render: (className?: string) => ReactNode;
};

const marketplaces: MarketplaceEntry[] = [
  { name: "Amazon", render: (c) => <AmazonLogo className={c} /> },
  { name: "Shopify", render: (c) => <ShopifyLogo className={c} /> },
];

function LogoCard({ item, pill }: { item: MarketplaceEntry; pill?: boolean }) {
  return (
    <div
      className={cn(
        pill
          ? "flex items-center justify-center h-11 min-w-[7.5rem] px-6 rounded-full bg-card border border-border hover:border-orange-300 transition-colors"
          : cardClass,
      )}
      title={item.name}
    >
      <div className={cn(logoBoxClass, pill && "h-5 w-24")}>{item.render()}</div>
      <span className="sr-only">{item.name}</span>
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
