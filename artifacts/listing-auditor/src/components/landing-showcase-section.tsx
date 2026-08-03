import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { ArrowRight, X } from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { parseDemoListings } from "@/lib/demo-listings";
import { parsePortfolioItems, type PortfolioCmsItem } from "@/lib/portfolio-cms";
import { AmazonListingDemo } from "@/components/amazon-listing-demo";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PortfolioLightbox({
  item,
  onClose,
}: {
  item: PortfolioCmsItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — ${item.brand}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center">
          <img
            src={item.image}
            alt={`${item.title} — ${item.brand}`}
            className="max-h-[calc(92vh-5rem)] w-full object-contain"
          />
        </div>
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 bg-white shrink-0">
          {item.title && <p className="font-semibold text-slate-900">{item.title}</p>}
          {item.brand && <p className={cn("text-sm text-slate-500", item.title && "mt-0.5")}>{item.brand}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PortfolioThumbGrid({ items }: { items: PortfolioCmsItem[] }) {
  const [selected, setSelected] = useState<PortfolioCmsItem | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="group relative w-full aspect-square rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 shadow-sm hover:shadow-md transition-shadow cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label={`View ${item.title} — ${item.brand}`}
          >
            <img
              src={item.image}
              alt={`${item.title} — ${item.brand}`}
              className={cn(
                "absolute inset-0 w-full h-full object-center pointer-events-none",
                item.square ? "object-cover" : "object-contain p-2",
              )}
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
            />
            {item.badge && (
              <span className="pointer-events-none absolute top-2 right-2 z-10 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {selected && <PortfolioLightbox item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export function LandingShowcaseSection({
  cms,
  showDemo = true,
  showGrid = true,
}: {
  cms: HomepageCmsMap;
  showDemo?: boolean;
  showGrid?: boolean;
}) {
  const demoListings = showDemo ? parseDemoListings(cms, basePath) : [];
  const portfolioItems = showGrid ? parsePortfolioItems(cms, basePath) : [];

  const eyebrow = cmsText(cms, "demo.eyebrow") || cmsText(cms, "portfolio.eyebrow");
  const heading = cmsText(cms, "demo.heading") || cmsText(cms, "portfolio.heading");
  const subheading = cmsText(cms, "demo.subheading") || cmsText(cms, "portfolio.subheading");
  const ctaText = cmsText(cms, "demo.cta_text") || cmsText(cms, "portfolio.cta_text");
  const ctaUrl = cmsText(cms, "demo.cta_url") || cmsText(cms, "portfolio.cta_url");
  const gridHeading = cmsText(cms, "portfolio.grid_heading");

  if (demoListings.length === 0 && portfolioItems.length === 0) return null;

  return (
    <section id="showcase" className="px-4 sm:px-6 lg:px-10 pt-12 pb-4 sm:pt-20 sm:pb-6 lg:pb-8 bg-gradient-to-b from-white via-orange-50/30 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center lg:text-left mb-8 sm:mb-10 lg:mb-12 max-w-3xl lg:max-w-none mx-auto lg:mx-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600 mb-3">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 sm:mb-4 leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {subheading}
            </p>
          )}
        </div>

        {demoListings.length > 0 && (
          <AmazonListingDemo
            listings={demoListings}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            className="mb-10 sm:mb-14"
          />
        )}

        {portfolioItems.length > 0 && (
          <div>
            {gridHeading && (
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 text-center lg:text-left mb-4 sm:mb-6">
                {gridHeading}
              </h3>
            )}
            <PortfolioThumbGrid items={portfolioItems} />
            {ctaText && ctaUrl && demoListings.length === 0 && (
              <div className="text-center mt-5 sm:mt-6">
                <Link href={ctaUrl} className="text-sm font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1">
                  {ctaText} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
