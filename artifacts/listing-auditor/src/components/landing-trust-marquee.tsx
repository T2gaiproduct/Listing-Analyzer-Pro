import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { MarketplaceLogos } from "@/components/marketplace-logos";
import { cn } from "@/lib/utils";

const MARQUEE_STYLE = `
  @keyframes landing-trust-marquee-kf {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .landing-trust-marquee-track {
    animation: landing-trust-marquee-kf 45s linear infinite;
  }
  .landing-trust-marquee-track:hover {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .landing-trust-marquee-track { animation: none !important; }
  }
`;

export function LandingTrustMarquee({ cms }: { cms: HomepageCmsMap }) {
  const heading = cmsText(cms, "trust.heading");
  const subheading = cmsText(cms, "trust.subheading");

  return (
    <section className="border-t border-slate-100 bg-white py-8 sm:py-10 overflow-hidden">
      <style>{MARQUEE_STYLE}</style>
      <div className="text-center px-4 mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500 mb-2">
          {heading}
        </p>
        {subheading && (
          <p className="text-sm text-slate-500 max-w-xl mx-auto">{subheading}</p>
        )}
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-white to-transparent z-10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-white to-transparent z-10"
          aria-hidden
        />
        <div className="flex landing-trust-marquee-track w-max gap-12 sm:gap-16 px-4">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-12 sm:gap-16">
              <MarketplaceLogos variant="pill" className="gap-10 sm:gap-14" />
              <div className={cn("flex items-center gap-8 text-slate-400 text-sm font-medium whitespace-nowrap")}>
                {["Agencies", "Brands", "Aggregators", "D2C Sellers"].map((label) => (
                  <span key={`${dup}-${label}`}>{label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
