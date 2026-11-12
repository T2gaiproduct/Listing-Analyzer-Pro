import { useState } from "react";
import { Link } from "wouter";
import { Store, Building2, Users, LineChart } from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import { Button } from "@/components/ui/button";
import { LANDING_SECTION_CLASS, LANDING_SECTION_PAD } from "@/lib/landing-layout";
import { cn } from "@/lib/utils";

const PERSONA_ICONS = [Store, Building2, Users, LineChart];

export function LandingPersonasSection({ cms }: { cms: HomepageCmsMap }) {
  const personas = [1, 2, 3, 4]
    .map((i) => ({
      title: cmsText(cms, `personas.item${i}_title`),
      desc: cmsText(cms, `personas.item${i}_desc`),
      ctaText: cmsText(cms, `personas.item${i}_cta_text`),
      ctaUrl: cmsText(cms, `personas.item${i}_cta_url`),
      icon: PERSONA_ICONS[i - 1],
    }))
    .filter((p) => p.title);

  const [active, setActive] = useState(0);

  if (personas.length === 0) return null;

  const heading = cmsText(cms, "personas.heading");
  const subheading = cmsText(cms, "personas.subheading");
  const current = personas[active] ?? personas[0];
  const Icon = current.icon;

  return (
    <section className={cn("py-12 sm:py-16 lg:py-20 bg-white border-t border-slate-100", LANDING_SECTION_PAD)}>
      <div className={LANDING_SECTION_CLASS}>
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3">{heading}</h2>
          {subheading && (
            <p className="text-sm sm:text-base text-slate-500">{subheading}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {personas.map((p, i) => (
            <button
              key={p.title}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                i === active
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div
          key={active}
          className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 sm:p-8 shadow-sm animate-in fade-in duration-300"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-orange-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{current.title}</h3>
              {current.desc && (
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5">{current.desc}</p>
              )}
              {current.ctaText && current.ctaUrl && (
                <Button className="bg-orange-500 hover:bg-orange-600" asChild>
                  <Link href={current.ctaUrl}>{current.ctaText}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
