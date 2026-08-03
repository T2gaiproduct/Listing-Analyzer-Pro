import { Link } from "wouter";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText, resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function LandingTransformationSection({ cms }: { cms: HomepageCmsMap }) {
  const heading = cmsText(cms, "transformation.heading");
  const subheading = cmsText(cms, "transformation.subheading");
  const beforeLabel = cmsText(cms, "transformation.before_label");
  const beforeImage = resolveCmsAssetUrl(cmsText(cms, "transformation.before_image"), basePath);
  const editorial = cmsText(cms, "transformation.editorial");
  const ctaText = cmsText(cms, "transformation.cta_text");
  const ctaUrl = cmsText(cms, "transformation.cta_url");

  const outputs = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => {
    const label = cmsText(cms, `transformation.output${i}_label`).trim();
    const image = resolveCmsAssetUrl(cmsText(cms, `transformation.output${i}_image`), basePath);
    if (!image) return [];
    return [{ label: label || `Output ${i}`, image }];
  });

  if (!heading && outputs.length === 0 && !beforeImage) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 bg-slate-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8 lg:gap-12 items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-400 mb-3">
              {cmsText(cms, "transformation.eyebrow")}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4">
              {heading}
            </h2>
            {subheading && (
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-lg">
                {subheading}
              </p>
            )}

            {editorial && (
              <div className="flex gap-3 items-start rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
                <Clock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300 leading-relaxed">{editorial}</p>
              </div>
            )}

            {ctaText && ctaUrl && (
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" asChild>
                <Link href={ctaUrl} className="gap-2">
                  {ctaText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            {beforeImage && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  {beforeLabel}
                </p>
                <div className="rounded-xl overflow-hidden bg-white/10 aspect-[4/3] max-h-52 sm:max-h-64">
                  <img src={beforeImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              </div>
            )}

            {outputs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {outputs.map((output) => (
                  <div
                    key={output.label}
                    className="rounded-xl border border-white/10 bg-white/5 overflow-hidden group"
                  >
                    <div className="aspect-square bg-white/10">
                      <img
                        src={output.image}
                        alt={output.label}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-300 px-2 py-2 text-center truncate">
                      {output.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
