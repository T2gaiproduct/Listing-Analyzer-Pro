import type { ReactNode } from "react";
import { FaAmazon } from "react-icons/fa6";
import { SiShopify, SiEbay, SiEtsy } from "react-icons/si";
import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";

/** Walmart spark + wordmark sized to match neighboring brand icons. */
function WalmartLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 36"
      className={cn("h-8 sm:h-9 w-auto", className)}
      role="img"
      aria-label="Walmart"
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

type MarketplaceEntry =
  | { name: string; kind: "icon"; Icon: IconType; className?: string }
  | { name: string; kind: "custom"; render: (className?: string) => ReactNode };

const marketplaces: MarketplaceEntry[] = [
  { name: "Amazon", kind: "icon", Icon: FaAmazon, className: "h-7 sm:h-8 w-[5.5rem] sm:w-[6.25rem] text-[#232F3E]" },
  { name: "Shopify", kind: "icon", Icon: SiShopify, className: "h-7 sm:h-8 w-[5.5rem] sm:w-[6rem] text-[#96BF48]" },
  { name: "Walmart", kind: "custom", render: (c) => <WalmartLogo className={c} /> },
  { name: "eBay", kind: "icon", Icon: SiEbay, className: "h-6 sm:h-7 w-[3.5rem] sm:w-16" },
  { name: "Etsy", kind: "icon", Icon: SiEtsy, className: "h-6 sm:h-7 w-[3.25rem] sm:w-[3.75rem] text-[#F45800]" },
];

function LogoCard({ item }: { item: MarketplaceEntry }) {
  return (
    <div
      className="flex items-center justify-center h-12 sm:h-14 px-4 sm:px-5 bg-white rounded-xl shadow-sm min-w-[6.75rem] sm:min-w-[7.5rem]"
      title={item.name}
    >
      {item.kind === "icon" ? (
        <item.Icon className={cn("shrink-0", item.className)} aria-hidden />
      ) : (
        item.render()
      )}
      <span className="sr-only">{item.name}</span>
    </div>
  );
}

export function MarketplaceLogos({ className }: { className?: string }) {
  const row1 = marketplaces.slice(0, 3);
  const row2 = marketplaces.slice(3);

  return (
    <div className={cn("flex flex-col gap-3 sm:gap-4 items-center lg:items-start", className)}>
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
        {row1.map((item) => (
          <LogoCard key={item.name} item={item} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
        {row2.map((item) => (
          <LogoCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
