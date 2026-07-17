import type { ReactNode } from "react";
import { SiShopify } from "react-icons/si";
import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const cardClass =
  "flex flex-1 min-w-0 basis-0 sm:flex-none sm:w-28 items-center justify-center h-9 sm:h-14 px-0.5 sm:px-3 bg-transparent";
const logoBoxClass = "flex items-center justify-center w-full h-4 sm:h-7 overflow-hidden";

/** Walmart spark + wordmark scaled to match neighboring brand icons. */
function WalmartLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 36"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Walmart"
      preserveAspectRatio="xMidYMid meet"
    >
      <text
        x="0"
        y="26"
        fill="#0071DC"
        fontSize="22"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        Walmart
      </text>
      <path
        fill="#FFC220"
        d="M118.5 4.5 121.2 12h7.8l-6.3 4.6 2.4 7.4-6.3-4.6-6.3 4.6 2.4-7.4-6.3-4.6h7.8z"
      />
    </svg>
  );
}

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

function EbayLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${basePath}/marketplace/ebay.svg`}
      alt=""
      className={cn("h-full w-auto max-w-full object-contain", className)}
      aria-hidden
    />
  );
}

function EtsyLogo({ className }: { className?: string }) {
  return (
    <img
      src={`${basePath}/marketplace/etsy.svg`}
      alt=""
      className={cn("h-full w-auto max-w-full object-contain", className)}
      aria-hidden
    />
  );
}

type MarketplaceEntry =
  | { name: string; kind: "icon"; Icon: IconType; className?: string }
  | { name: string; kind: "custom"; render: (className?: string) => ReactNode };

const marketplaces: MarketplaceEntry[] = [
  { name: "Amazon", kind: "custom", render: (c) => <AmazonLogo className={c} /> },
  { name: "Shopify", kind: "icon", Icon: SiShopify, className: "text-[#96BF48]" },
  { name: "Walmart", kind: "custom", render: (c) => <WalmartLogo className={c} /> },
  { name: "eBay", kind: "custom", render: (c) => <EbayLogo className={c} /> },
  { name: "Etsy", kind: "custom", render: (c) => <EtsyLogo className={c} /> },
];

function LogoCard({ item }: { item: MarketplaceEntry }) {
  return (
    <div className={cardClass} title={item.name}>
      <div className={logoBoxClass}>
        {item.kind === "icon" ? (
          <item.Icon className={cn("h-full w-auto max-w-full", item.className)} aria-hidden />
        ) : (
          item.render()
        )}
      </div>
      <span className="sr-only">{item.name}</span>
    </div>
  );
}

export function MarketplaceLogos({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-nowrap items-center justify-center sm:justify-start gap-1 sm:gap-3 w-full",
        className,
      )}
    >
      {marketplaces.map((item) => (
        <LogoCard key={item.name} item={item} />
      ))}
    </div>
  );
}
