import {
  ClipboardList, Image, Wand2, BarChart3, Upload, Globe, Users, Zap,
} from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { LandingScrollReveal } from "@/components/landing-scroll-reveal";
import { LANDING_SECTION_CLASS, LANDING_SECTION_PAD } from "@/lib/landing-layout";
import { cn } from "@/lib/utils";

const TILE_ICONS = [ClipboardList, Image, Wand2, BarChart3, Upload, Globe, Users, Zap];

export function LandingFeatureTiles({ cms }: { cms: HomepageCmsMap }) {
  const tiles = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((i) => ({
      title: cmsText(cms, `tiles.item${i}_title`),
      desc: cmsText(cms, `tiles.item${i}_desc`),
      icon: TILE_ICONS[i - 1],
    }))
    .filter((t) => t.title);

  if (tiles.length === 0) return null;

  const heading = cmsText(cms, "tiles.heading");
  const subheading = cmsText(cms, "tiles.subheading");

  return (
    <section className={cn("py-12 sm:py-16 bg-slate-50/80 border-t border-slate-100", LANDING_SECTION_PAD)}>
      <div className={LANDING_SECTION_CLASS}>
        <div className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">{heading}</h2>
          {subheading && (
            <p className="text-sm sm:text-base text-slate-500">{subheading}</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {tiles.map((tile, index) => {
            const Icon = tile.icon;
            return (
              <LandingScrollReveal key={tile.title} delayMs={index * 80}>
                <div className="h-full rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md hover:border-orange-200/80 transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base mb-1.5">
                    {tile.title}
                  </h3>
                  {tile.desc && (
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{tile.desc}</p>
                  )}
                </div>
              </LandingScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
