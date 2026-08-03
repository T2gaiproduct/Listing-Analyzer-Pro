import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Clock, Play } from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import {
  buildTutorialPreviewItems,
  tutorialCategoryLabel,
  type TutorialPreviewItem,
} from "@/lib/tutorials-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FAN_LAYOUT = [
  { rotateY: 22, translateZ: -70, scale: 0.88, zIndex: 1 },
  { rotateY: 11, translateZ: -20, scale: 0.94, zIndex: 2 },
  { rotateY: 0, translateZ: 40, scale: 1, zIndex: 5 },
  { rotateY: -11, translateZ: -20, scale: 0.94, zIndex: 2 },
  { rotateY: -22, translateZ: -70, scale: 0.88, zIndex: 1 },
] as const;

function TutorialFanCard({
  item,
  visible,
  isCenter,
}: {
  item: TutorialPreviewItem;
  visible: boolean;
  isCenter: boolean;
}) {
  const href = item.linkUrl?.trim() || "/tutorials";
  const isExternal = href.startsWith("http");
  const category = tutorialCategoryLabel(item.category || "getting-started");

  const shell = (
    <div
      className={cn(
        "relative w-[190px] sm:w-[220px] md:w-[250px] lg:w-[270px] xl:w-[290px] aspect-[9/16] rounded-[1.5rem] sm:rounded-[1.65rem] bg-white overflow-hidden transition-all duration-1000 ease-out",
        "border-[3px] shadow-xl",
        isCenter
          ? "border-orange-400 ring-2 ring-orange-200/70 shadow-orange-100/60"
          : "border-slate-200/90 shadow-slate-200/80",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
      )}
    >
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-slate-200 z-20" />
      {item.image ? (
        <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/92 via-slate-900/20 to-transparent" />

      <div className="absolute top-11 left-3 right-3 z-10">
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-orange-50 bg-orange-500 px-2.5 py-1 rounded-full shadow-sm">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span className="truncate">{category}</span>
        </span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div
          className={cn(
            "rounded-full bg-white/95 flex items-center justify-center shadow-lg border border-white/90",
            isCenter ? "w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]" : "w-14 h-14 sm:w-16 sm:h-16",
          )}
        >
          <Play
            className={cn(
              "text-orange-500 fill-orange-500 ml-0.5",
              isCenter ? "w-7 h-7 sm:w-8 sm:h-8" : "w-6 h-6 sm:w-7 sm:h-7",
            )}
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-4 z-10">
        <p className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-2">{item.title}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] sm:text-xs text-white/80">
          {item.duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {item.duration}
            </span>
          )}
          {item.steps && <span>{item.steps} steps</span>}
        </div>
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
        {shell}
      </a>
    );
  }

  return (
    <Link href={href} className="group block">
      {shell}
    </Link>
  );
}

function FanSlot({
  item,
  index,
  layout,
  visible,
  isCenter,
  reduceMotion,
}: {
  item: TutorialPreviewItem;
  index: number;
  layout: typeof FAN_LAYOUT[number];
  visible: boolean;
  isCenter: boolean;
  reduceMotion: boolean;
}) {
  const transform = visible
    ? `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale})`
    : `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale * 0.9}) translateY(36px)`;

  return (
    <div
      className={cn(
        "shrink-0 transition-all duration-1000 ease-out",
        index > 0 && "-ml-10 sm:-ml-12 md:-ml-14 lg:-ml-16",
      )}
      style={{
        transform,
        transformOrigin: "50% 100%",
        zIndex: layout.zIndex,
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div
        className={cn(visible && !reduceMotion && "tutorials-fan-float")}
        style={{ animationDelay: `${index * 0.35}s` }}
      >
        <TutorialFanCard item={item} visible={visible} isCenter={isCenter} />
      </div>
    </div>
  );
}

export function LandingTutorialsShowcase({ cms }: { cms: HomepageCmsMap }) {
  const tutorials = buildTutorialPreviewItems(cms, basePath);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const heading = cmsText(cms, "tutorials.heading");
  const subheading = cmsText(cms, "tutorials.subheading");
  const ctaText = cmsText(cms, "tutorials.cta_text");
  const ctaUrl = cmsText(cms, "tutorials.cta_url");

  const phoneItems = tutorials.slice(0, 5);
  while (phoneItems.length < 5 && tutorials.length > 0) {
    phoneItems.push(tutorials[phoneItems.length % tutorials.length]);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (reduceMotion) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  if (tutorials.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="tutorials"
      className="relative py-16 sm:py-20 lg:py-24 overflow-visible bg-gradient-to-b from-white via-orange-50/50 to-white border-t border-slate-100"
    >
      <style>{`
        @keyframes tutorials-fan-float-kf {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        .tutorials-fan-float { animation: tutorials-fan-float-kf 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tutorials-fan-float { animation: none !important; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,102,0,0.09),transparent_55%)] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12 max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600 mb-3">
            Video guides
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-500 leading-relaxed">
              {subheading}
            </p>
          )}
        </div>

        <div className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 overflow-x-auto overflow-y-visible scrollbar-hide md:overflow-x-visible">
          <div
            className="mx-auto flex justify-center items-end py-8 sm:py-10 min-h-[400px] sm:min-h-[480px] lg:min-h-[520px]"
            style={{ perspective: "1700px", perspectiveOrigin: "50% 100%" }}
          >
            <div
              className="inline-flex items-end justify-center origin-bottom scale-[0.8] sm:scale-[0.88] md:scale-[0.94] lg:scale-[0.98] xl:scale-100 px-6 sm:px-10"
              style={{ transformStyle: "preserve-3d" }}
            >
              {phoneItems.map((item, index) => (
                <FanSlot
                  key={`${item.title}-${index}`}
                  item={item}
                  index={index}
                  layout={FAN_LAYOUT[index] ?? FAN_LAYOUT[2]}
                  visible={visible}
                  isCenter={index === 2}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          </div>
        </div>

        {ctaText && ctaUrl && (
          <div className="text-center mt-4 sm:mt-6">
            <Link
              href={ctaUrl}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-6 py-2.5 shadow-md shadow-orange-200 transition-colors"
            >
              {ctaText}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
