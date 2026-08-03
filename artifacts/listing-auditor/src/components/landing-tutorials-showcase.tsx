import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialVideoDialog } from "@/components/tutorial-video-dialog";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";
import {
  arrangeTutorialsForFan,
  buildTutorialPreviewItems,
  tutorialCategoryLabel,
  tutorialHasPlayableVideo,
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
  onPlayVideo,
}: {
  item: TutorialPreviewItem;
  visible: boolean;
  isCenter: boolean;
  onPlayVideo: (item: TutorialPreviewItem) => void;
}) {
  const href = item.linkUrl?.trim() || "/tutorials";
  const isExternal = href.startsWith("http");
  const category = tutorialCategoryLabel(item.category || "getting-started");
  const hasPlayableVideo = tutorialHasPlayableVideo(item);

  const shell = (
    <div
      className={cn(
        "group flex flex-col w-[190px] sm:w-[220px] md:w-[250px] lg:w-[270px] xl:w-[290px] rounded-2xl overflow-hidden bg-white transition-all duration-1000 ease-out",
        "shadow-sm hover:shadow-md",
        isCenter
          ? "border-2 border-orange-400 shadow-lg shadow-orange-100/80"
          : "border border-slate-200/80",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        hasPlayableVideo && "cursor-pointer",
      )}
      onClick={hasPlayableVideo ? () => onPlayVideo(item) : undefined}
      onKeyDown={hasPlayableVideo ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlayVideo(item);
        }
      } : undefined}
      role={hasPlayableVideo ? "button" : undefined}
      tabIndex={hasPlayableVideo ? 0 : undefined}
    >
      <div className="relative aspect-[5/6] bg-slate-100 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        {hasPlayableVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "rounded-full bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform",
                isCenter ? "w-14 h-14 sm:w-16 sm:h-16" : "w-12 h-12 sm:w-14 sm:h-14",
              )}
            >
              <Play
                className={cn(
                  "fill-none stroke-orange-500 stroke-[2.5] ml-0.5",
                  isCenter ? "w-6 h-6 sm:w-7 sm:h-7" : "w-5 h-5 sm:w-6 sm:h-6",
                )}
              />
            </div>
          </div>
        )}
        {item.duration && (
          <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-xs font-medium px-2 py-0.5 rounded-md">
            {item.duration}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 bg-white p-4 sm:p-5 min-h-[6rem]">
        {category && (
          <span className="text-xs font-medium text-orange-500 mb-1.5 self-start">
            {category}
          </span>
        )}
        <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
          {item.title}
        </p>
        {item.steps && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {item.steps} steps
          </p>
        )}
      </div>
    </div>
  );

  if (hasPlayableVideo) {
    return shell;
  }

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {shell}
      </a>
    );
  }

  return (
    <Link href={href} className="block">
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
  onPlayVideo,
}: {
  item: TutorialPreviewItem;
  index: number;
  layout: typeof FAN_LAYOUT[number];
  visible: boolean;
  isCenter: boolean;
  reduceMotion: boolean;
  onPlayVideo: (item: TutorialPreviewItem) => void;
}) {
  const transform = visible
    ? `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale})`
    : `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale * 0.9}) translateY(36px)`;

  return (
    <div
      className={cn(
        "shrink-0 transition-all duration-1000 ease-out relative hover:!z-[20] focus-within:!z-[20]",
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
        <TutorialFanCard item={item} visible={visible} isCenter={isCenter} onPlayVideo={onPlayVideo} />
      </div>
    </div>
  );
}

export function LandingTutorialsShowcase({ cms }: { cms: HomepageCmsMap }) {
  const tutorials = buildTutorialPreviewItems(cms, basePath);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoItem, setVideoItem] = useState<TutorialPreviewItem | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const heading = cmsText(cms, "tutorials.heading");
  const subheading = cmsText(cms, "tutorials.subheading");
  const ctaText = cmsText(cms, "tutorials.cta_text");
  const ctaUrl = cmsText(cms, "tutorials.cta_url");

  const phoneItems = arrangeTutorialsForFan(tutorials);

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

  function openVideo(item: TutorialPreviewItem) {
    if (!tutorialHasPlayableVideo(item)) return;
    setVideoItem(item);
    setVideoOpen(true);
  }

  function closeVideo(open: boolean) {
    setVideoOpen(open);
    if (!open) setVideoItem(null);
  }

  return (
    <section
      ref={sectionRef}
      id="tutorials"
      className="relative px-4 sm:px-6 lg:px-10 pt-4 pb-4 sm:py-20 overflow-visible bg-slate-50 border-t border-slate-100"
    >
      <style>{`
        @keyframes tutorials-fan-float-kf {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .tutorials-fan-float { animation: tutorials-fan-float-kf 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tutorials-fan-float { animation: none !important; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,102,0,0.05),transparent_55%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 sm:mb-4">
            {heading}
          </h2>
          {subheading && (
            <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
              {subheading}
            </p>
          )}
        </div>

        <div
          className="relative left-1/2 w-[100vw] max-w-[100vw] -translate-x-1/2 overflow-x-auto overflow-y-visible scrollbar-hide md:overflow-x-visible mb-2 sm:mb-4"
          style={{ perspective: "1700px", perspectiveOrigin: "50% 100%" }}
        >
          <div className="flex justify-center items-end py-8 sm:py-10 min-h-[400px] sm:min-h-[480px] lg:min-h-[520px]">
            <div
              className="inline-flex items-end justify-center origin-bottom scale-[0.8] sm:scale-[0.88] md:scale-[0.94] lg:scale-[0.98] xl:scale-100 px-4 sm:px-8"
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
                  onPlayVideo={openVideo}
                />
              ))}
            </div>
          </div>
        </div>

        {ctaText && ctaUrl && (
          <div className="text-center mt-5 sm:mt-8">
            <Button
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 shadow-sm h-11 px-6"
              asChild
            >
              <Link href={ctaUrl} className="inline-flex items-center gap-2">
                {ctaText}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {videoItem?.videoUrl && (
        <TutorialVideoDialog
          open={videoOpen}
          onOpenChange={closeVideo}
          title={videoItem.title}
          duration={videoItem.duration}
          videoUrl={videoItem.videoUrl}
        />
      )}
    </section>
  );
}
