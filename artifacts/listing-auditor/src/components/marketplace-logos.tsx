import { SiShopify, SiWalmart, SiEbay, SiEtsy } from "react-icons/si";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const iconLogos = [
  { name: "Shopify", Icon: SiShopify, className: "h-5 sm:h-[1.35rem] w-auto text-[#96BF48]" },
  { name: "Walmart", Icon: SiWalmart, className: "h-5 sm:h-[1.35rem] w-auto text-[#0071CE]" },
  { name: "eBay", Icon: SiEbay, className: "h-4 sm:h-5 w-auto text-[#E53238]" },
  { name: "Etsy", Icon: SiEtsy, className: "h-4 sm:h-5 w-auto text-[#F45800]" },
] as const;

export function MarketplaceLogos({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3", className)}>
      <div
        className="flex items-center justify-center h-10 sm:h-11 px-4 sm:px-5 bg-white rounded-xl border border-slate-200/80 shadow-sm min-w-[5.5rem]"
        title="Amazon"
      >
        <img
          src={`${basePath}/logos/amazon.svg`}
          alt="Amazon"
          className="h-4 sm:h-[1.1rem] w-auto"
        />
      </div>
      {iconLogos.map(({ name, Icon, className: iconClass }) => (
        <div
          key={name}
          className="flex items-center justify-center h-10 sm:h-11 px-4 sm:px-5 bg-white rounded-xl border border-slate-200/80 shadow-sm min-w-[5.5rem]"
          title={name}
        >
          <Icon className={iconClass} aria-hidden />
          <span className="sr-only">{name}</span>
        </div>
      ))}
    </div>
  );
}
