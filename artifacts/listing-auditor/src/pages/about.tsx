import { PublicNav, PublicFooter } from "@/components/public-layout";
import { PageSeo } from "@/components/page-seo";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";
import { cmsText } from "@/lib/homepage-cms";
import {
  ABOUT_MISSION_ICONS,
  ABOUT_VALUE_ICONS,
  parseAboutMissionHighlights,
  parseAboutMilestones,
  parseAboutValues,
} from "@/lib/about-cms";
import { cn } from "@/lib/utils";

const MISSION_HIGHLIGHT_STYLES = [
  { wrap: "bg-orange-100", icon: "text-orange-600" },
  { wrap: "bg-blue-100", icon: "text-blue-600" },
  { wrap: "bg-emerald-100", icon: "text-emerald-600" },
] as const;

export default function About() {
  const cms = useHomepageCmsContext();
  const values = parseAboutValues(cms);
  const missionHighlights = parseAboutMissionHighlights(cms);
  const milestones = parseAboutMilestones(cms);

  return (
    <div className="min-h-[100dvh] bg-white">
      <PageSeo
        pageSlug="about"
        title="About Us"
        description="Meet the team behind Ecommerce Guru and learn how we're helping Amazon sellers optimize listings with AI-powered audits."
      />
      <PublicNav />

      <main>
        <section className="relative overflow-hidden bg-slate-900 text-white py-14 md:py-20">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
          </div>
          <div className="relative max-w-4xl mx-auto px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {cmsText(cms, "about.hero_heading_line1")}
              <br />
              {cmsText(cms, "about.hero_heading_line2")}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {cmsText(cms, "about.hero_subheading")}
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-3">
                  {cmsText(cms, "about.mission_heading")}
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">
                  {cmsText(cms, "about.mission_body_1")}
                </p>
                <p className="text-lg text-slate-600 leading-relaxed">
                  {cmsText(cms, "about.mission_body_2")}
                </p>
              </div>
              {missionHighlights.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-6 md:p-7 border border-slate-100">
                  <div className="space-y-5">
                    {missionHighlights.map((item, i) => {
                      const Icon = ABOUT_MISSION_ICONS[i] ?? ABOUT_MISSION_ICONS[0];
                      const style = MISSION_HIGHLIGHT_STYLES[i] ?? MISSION_HIGHLIGHT_STYLES[0];
                      return (
                        <div key={item.title} className="flex items-center gap-4">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                              style.wrap,
                            )}
                          >
                            <Icon className={cn("w-6 h-6", style.icon)} />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                            {item.desc && (
                              <p className="text-base text-slate-600">{item.desc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 sm:px-8">
            <div className="text-center mb-8 md:mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-2">
                {cmsText(cms, "about.values_heading")}
              </h2>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">
                {cmsText(cms, "about.values_subheading")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {values.map((v, i) => {
                const Icon = ABOUT_VALUE_ICONS[i] ?? ABOUT_VALUE_ICONS[0];
                return (
                  <div key={v.title} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                    <Icon className="w-8 h-8 text-orange-500 mb-3" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{v.title}</h3>
                    <p className="text-base text-slate-600 leading-relaxed">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {milestones.length > 0 && (
          <section className="py-12 md:py-16 bg-white pb-14 md:pb-16">
            <div className="max-w-4xl mx-auto px-6 sm:px-8">
              <div className="text-center mb-8 md:mb-10">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-2">
                  {cmsText(cms, "about.journey_heading")}
                </h2>
                <p className="text-lg text-slate-600">{cmsText(cms, "about.journey_subheading")}</p>
              </div>
              <div className="space-y-5">
                {milestones.map((m, i) => (
                  <div key={`${m.year}-${m.title}`} className="flex gap-5">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-base">
                        {m.year.slice(-2)}
                      </div>
                      {i < milestones.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 mt-2" />
                      )}
                    </div>
                    <div className="pb-4 md:pb-5">
                      <span className="text-sm font-semibold text-orange-600 uppercase tracking-wider">
                        {m.year}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-900 mt-1">{m.title}</h3>
                      <p className="text-base text-slate-600 mt-1 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}