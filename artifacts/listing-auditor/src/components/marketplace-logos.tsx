import { FaAmazon } from "react-icons/fa6";
import { SiShopify, SiWalmart, SiEbay, SiEtsy } from "react-icons/si";
import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";

const marketplaces: Array<{
  name: string;
  Icon: IconType;
  className?: string;
}> = [
  { name: "Amazon", Icon: FaAmazon, className: "h-7 sm:h-8 w-[5.5rem] sm:w-[6.25rem] text-[#232F3E]" },
  { name: "Shopify", Icon: SiShopify, className: "h-7 sm:h-8 w-[5.5rem] sm:w-[6rem] text-[#96BF48]" },
  { name: "Walmart", Icon: SiWalmart, className: "h-6 sm:h-7 w-[5.75rem] sm:w-[6.5rem] text-[#0071CE]" },
  { name: "eBay", Icon: SiEbay, className: "h-6 sm:h-7 w-[3.5rem] sm:w-16" },
  { name: "Etsy", Icon: SiEtsy, className: "h-6 sm:h-7 w-[3.25rem] sm:w-[3.75rem] text-[#F45800]" },
];

export function MarketplaceLogos({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4", className)}>
      {marketplaces.map(({ name, Icon, className: iconClass }) => (
        <div
          key={name}
          className="flex items-center justify-center h-12 sm:h-14 px-4 sm:px-5 bg-white rounded-xl shadow-sm min-w-[6.75rem] sm:min-w-[7.5rem]"
          title={name}
        >
          <Icon className={cn("shrink-0", iconClass)} aria-hidden />
          <span className="sr-only">{name}</span>
        </div>
      ))}
    </div>
  );
}
