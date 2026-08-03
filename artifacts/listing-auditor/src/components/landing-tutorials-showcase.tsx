import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialVideoDialog } from "@/components/tutorial-video-dialog";
import { TutorialVideoThumbnail } from "@/components/tutorial-video-thumbnail";
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

function resolveFanSlotAtPoint(
  slotRefs: Array<HTMLDivElement | null>,
  clientX: number,
  clientY: number,
): number | null {
  let best: { index: number; distance: number } | null = null;

  for (let i = 0; i < slotRefs.length; i++) {
    const el = slotRefs[i];
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    if (
      clientX < rect.left
      || clientX > rect.right
      || clientY < rect.top
      || clientY > rect.bottom
    ) {
      continue;
    }

    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = dx * dx + dy * dy;

    if (!best || distance < best.distance) {
      best = { index: i, distance };
    }
  }

  return best?.index ?? null;
}

function TutorialFanCard({
  item,
  visible,
  isCenter,
  reduceMotion,
  isHovered,
}: {
  item: TutorialPreviewItem;
  visible: boolean;
  isCenter: boolean;
  reduceMotion: boolean;
  isHovered: boolean;
}) {
  const href = item.linkUrl?.trim() || "/tutorials";
  const isExternal = href.startsWith("http");
  const category = tutorialCategoryLabel(item.category || "getting-started");
  const hasPlayableVideo = tutorialHasPlayableVideo(item);
  const showPreview = visible && !reduceMotion;

  const shell = (
    <div
      className={cn(
        "group flex flex-col w-[190px] sm:w-[220px] md:w-[250px] lg:w-[270px] xl:w-[290px] rounded-2xl overflow-hidden bg-white transition-all duration-1000 ease-out pointer-events-none",
        "shadow-sm",
        isHovered && "shadow-md",
        isCenter
          ? "border-2 border-orange-400 shadow-lg shadow-orange-100/80"
          : "border border-slate-200/80",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
      )}
    >
      {hasPlayableVideo ? (
        <TutorialVideoThumbnail
          title={item.title}
          videoUrl={item.videoUrl}
          image={item.image}
          duration={item.duration}
          aspectClassName="aspect-[5/6]"
          playSize={isCenter ? "lg" : "sm"}
          showPreview={showPreview}
          playOverlayClassName={
            showPreview
              ? isHovered ? "opacity-100" : undefined
              : "opacity-100"
          }
          className="rounded-none"
          interactive={false}
        />
      ) : (
        <div className="relative aspect-[5/6] bg-slate-100 overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
          )}
          {item.duration && (
            <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-xs font-medium px-2 py-0.5 rounded-md">
              {item.duration}
            </span>
          )}
        </div>
      )}

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
      <a href={href} target="_blank" rel="noopener noreferrer" className="block pointer-events-auto">
        {shell}
      </a>
    );
  }

  return (
    <Link href={href} className="block pointer-events-auto">
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
  slotRef,
  stackZIndex,
  isHovered,
}: {
  item: TutorialPreviewItem;
  index: number;
  layout: typeof FAN_LAYOUT[number];
  visible: boolean;
  isCenter: boolean;
  reduceMotion: boolean;
  slotRef: (el: HTMLDivElement | null) => void;
  stackZIndex: number;
  isHovered: boolean;
}) {
  const transform = visible
    ? `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale})`
    : `rotateY(${layout.rotateY}deg) translateZ(${layout.translateZ}px) scale(${layout.scale * 0.9}) translateY(36px)`;

  return (
    <div
      className={cn(
        "shrink-0 relative pointer-events-none",
        index > 0 && "-ml-10 sm:-ml-12 md:-ml-14 lg:-ml-16",
      )}
      style={{
        zIndex: stackZIndex,
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div
        ref={slotRef}
        className={cn(
          "transition-all duration-300 ease-out",
          visible && !reduceMotion && "tutorials-fan-float",
        )}
        style={{
          transform,
          transformOrigin: "50% 100%",
          animationDelay: `${index * 0.35}s`,
        }}
      >
        <TutorialFanCard
          item={item}
          visible={visible}
          isCenter={isCenter}
          reduceMotion={reduceMotion}
          isHovered={isHovered}
        />
      </div>
    </div>
  );
}

export function LandingTutorialsShowcase({ cms }: { cms: HomepageCmsMap }) {
  const tutorials = buildTutorialPreviewItems(cms, basePath);
  const sectionRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoItem, setVideoItem] = useState<TutorialPreviewItem | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

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
    if (!open) {
      window.setTimeout(() => setVideoItem(null), 250);
    }
  }

  function handleFanPointerMove(clientX: number, clientY: number) {
    const idx = resolveFanSlotAtPoint(slotRefs.current, clientX, clientY);
    setHoveredSlot(idx);
  }

  function handleFanClick(clientX: number, clientY: number) {
    const idx = resolveFanSlotAtPoint(slotRefs.current, clientX, clientY);
    if (idx === null) return;
    const item = phoneItems[idx];
    if (tutorialHasPlayableVideo(item)) {
      openVideo(item);
      return;
    }
    const href = item.linkUrl?.trim() || "/tutorials";
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else if (href.startsWith("/")) {
      navigate(href);
    }
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
              className="inline-flex items-end justify-center origin-bottom scale-[0.8] sm:scale-[0.88] md:scale-[0.94] lg:scale-[0.98] xl:scale-100 px-4 sm:px-8 cursor-pointer"
              style={{ transformStyle: "preserve-3d" }}
              onPointerMove={(e) => handleFanPointerMove(e.clientX, e.clientY)}
              onPointerLeave={() => setHoveredSlot(null)}
              onClick={(e) => {
                e.preventDefault();
                handleFanClick(e.clientX, e.clientY);
              }}
            >
              {phoneItems.map((item, index) => {
                const layout = FAN_LAYOUT[index] ?? FAN_LAYOUT[2];
                const stackZIndex = hoveredSlot === index ? 50 : layout.zIndex;

                return (
                  <FanSlot
                    key={`${item.title}-${index}`}
                    item={item}
                    index={index}
                    layout={layout}
                    visible={visible}
                    isCenter={index === 2}
                    reduceMotion={reduceMotion}
                    stackZIndex={stackZIndex}
                    isHovered={hoveredSlot === index}
                    slotRef={(el) => {
                      slotRefs.current[index] = el;
                    }}
                  />
                );
              })}
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

      <TutorialVideoDialog
        open={videoOpen}
        onOpenChange={closeVideo}
        title={videoItem?.title ?? ""}
        duration={videoItem?.duration}
        videoUrl={videoItem?.videoUrl ?? ""}
      />
    </section>
  );
}
