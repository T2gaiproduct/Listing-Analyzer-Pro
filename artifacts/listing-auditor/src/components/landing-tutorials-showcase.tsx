import { Link } from "wouter";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import {
  buildTutorialPreviewItems,
  tutorialCategoryLabel,
  type TutorialPreviewItem,
} from "@/lib/tutorials-cms";
import { youtubeEmbedUrl } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type BentoSlot = "tall-left" | "stack-top" | "stack-bottom" | "stack-top-2" | "stack-bottom-2" | "tall-right";

const BENTO_LAYOUT: BentoSlot[] = [
  "tall-left",
  "stack-top",
  "stack-bottom",
  "stack-top-2",
  "stack-bottom-2",
  "tall-right",
];

const SLOT_GRID_CLASS: Record<BentoSlot, string> = {
  "tall-left": "row-span-2",
  "stack-top": "",
  "stack-bottom": "",
  "stack-top-2": "",
  "stack-bottom-2": "",
  "tall-right": "row-span-2 col-span-2 lg:col-span-1",
};

function ShowcaseCard({
  item,
  className,
}: {
  item: TutorialPreviewItem;
  className?: string;
}) {
  const category = item.category ? tutorialCategoryLabel(item.category) : item.title;
  const badge = category.toUpperCase();
  const stat = item.duration || item.steps ? `${item.steps} steps` : "";
  const href = item.linkUrl?.trim() || "/tutorials";
  const isExternal = href.startsWith("http");

  const card = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg transition-transform duration-300 hover:scale-[1.01] h-full min-h-[140px]",
        className,
      )}
    >
      {item.image ? (
        <img
          src={item.image}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/70">{badge}</p>
          {stat && <p className="text-sm sm:text-base font-semibold text-white mt-0.5">{stat}</p>}
        </div>
        <span className="shrink-0 w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white opacity-80 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );

  if (item.videoUrl && youtubeEmbedUrl(item.videoUrl)) {
    return (
      <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
        {card}
      </a>
    );
  }

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {card}
      </a>
    );
  }

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  );
}

function MiniPreviewStack({ items }: { items: TutorialPreviewItem[] }) {
  const previews = items.slice(0, 3);
  if (previews.length === 0) return null;

  return (
    <div className="flex gap-2 mt-8">
      {previews.map((item, i) => (
        <div
          key={`${item.title}-${i}`}
          className={cn(
            "w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden border border-white/15 shadow-lg -rotate-3",
            i === 1 && "rotate-0 -mt-1",
            i === 2 && "rotate-3",
          )}
        >
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-slate-800" />
          )}
        </div>
      ))}
    </div>
  );
}

export function LandingTutorialsShowcase({ cms }: { cms: HomepageCmsMap }) {
  const tutorials = buildTutorialPreviewItems(cms, basePath);
  if (tutorials.length === 0) return null;

  const line1 = cmsText(cms, "tutorials.showcase_line1");
  const line2 = cmsText(cms, "tutorials.showcase_line2");
  const body = cmsText(cms, "tutorials.showcase_body");
  const primaryText = cmsText(cms, "tutorials.showcase_primary_text");
  const primaryUrl = cmsText(cms, "tutorials.showcase_primary_url");
  const secondaryText = cmsText(cms, "tutorials.showcase_secondary_text");
  const secondaryUrl = cmsText(cms, "tutorials.showcase_secondary_url");

  const stats = [1, 2, 3, 4].map((i) => ({
    label: cmsText(cms, `tutorials.showcase_stat${i}_label`),
    value: cmsText(cms, `tutorials.showcase_stat${i}_value`),
  })).filter((s) => s.label && s.value);

  const gridItems = tutorials.slice(0, 6);
  while (gridItems.length < 6 && tutorials.length > 0) {
    gridItems.push(tutorials[gridItems.length % tutorials.length]);
  }

  return (
    <section
      id="tutorials"
      className="relative px-4 sm:px-6 lg:px-10 py-14 sm:py-20 lg:py-24 overflow-hidden bg-[#0a0a0b]"
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-8 lg:gap-10 xl:gap-14 items-start">
          <div className="min-w-0 lg:py-4">
            {cmsText(cms, "tutorials.heading") && (
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-400/90 mb-4">
                {cmsText(cms, "tutorials.heading")}
              </p>
            )}
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.08] tracking-tight text-white">
              {line1}
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                {line2}
              </span>
            </h2>
            {body && (
              <p className="mt-5 text-sm sm:text-base text-slate-400 leading-relaxed max-w-md">
                {body}
              </p>
            )}
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
              {primaryText && primaryUrl && (
                <Button
                  size="lg"
                  className="rounded-full bg-white text-slate-900 hover:bg-slate-100 font-semibold px-6 h-11 gap-2"
                  asChild
                >
                  <Link href={primaryUrl}>
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    {primaryText}
                  </Link>
                </Button>
              )}
              {secondaryText && secondaryUrl && (
                <Link
                  href={secondaryUrl}
                  className="text-sm font-medium text-white/80 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  {secondaryText}
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <MiniPreviewStack items={tutorials} />
          </div>

          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 auto-rows-[minmax(130px,1fr)] lg:grid-rows-2 lg:min-h-[440px]"
          >
            {BENTO_LAYOUT.map((slot, index) => {
              const item = gridItems[index];
              if (!item) return null;
              return (
                <div key={`${slot}-${item.title}-${index}`} className={SLOT_GRID_CLASS[slot]}>
                  <ShowcaseCard item={item} />
                </div>
              );
            })}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-8 sm:mt-10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-white mt-1 truncate">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
