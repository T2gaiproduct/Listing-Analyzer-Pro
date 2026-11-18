import { useState } from "react";
import { Link } from "wouter";
import { ClipboardList, Play } from "lucide-react";
import { TutorialVideoDialog } from "@/components/tutorial-video-dialog";
import { TutorialVideoThumbnail } from "@/components/tutorial-video-thumbnail";
import { youtubeEmbedUrl } from "@/lib/video-embed";
import { parseTutorialSopLines, tutorialSopStepCount } from "@/lib/tutorial-sop";
import { cn } from "@/lib/utils";
import type { TutorialPreviewItem } from "@/lib/tutorials-cms";

type TutorialCardProps = TutorialPreviewItem & {
  layout?: "grid" | "carousel" | "page";
  fallbackHref?: string;
};

export function TutorialCard({
  title,
  duration,
  image,
  videoUrl,
  description,
  steps,
  sop,
  categoryLabel,
  linkUrl,
  layout = "grid",
  fallbackHref = "/tutorials",
}: TutorialCardProps & { categoryLabel?: string }) {
  const [open, setOpen] = useState(false);
  const embedUrl = videoUrl ? youtubeEmbedUrl(videoUrl) : null;
  const hasPlayableVideo = Boolean(videoUrl?.trim() && embedUrl);
  const sopLines = parseTutorialSopLines(sop);
  const hasSopContent = sopLines.length > 0;
  const stepCountLabel = tutorialSopStepCount(sop, steps);
  const isCarousel = layout === "carousel";
  const isPage = layout === "page";
  const externalHref = linkUrl?.trim() || fallbackHref;

  if (hasPlayableVideo) {
    return (
      <>
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm h-full flex flex-col">
          <TutorialVideoThumbnail
            title={title}
            videoUrl={videoUrl}
            image={image}
            duration={duration}
            onClick={() => setOpen(true)}
            aspectClassName={isCarousel ? "aspect-video" : isPage ? "h-44" : "h-44 sm:h-48 lg:h-52"}
            playSize={isCarousel ? "lg" : "md"}
            showPreview={false}
          />
          <div className={cn(isPage ? "p-6" : isCarousel ? "p-5" : "p-4")}>
            {categoryLabel && (
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                {categoryLabel}
              </span>
            )}
            <p className={cn("font-semibold text-slate-800", isCarousel ? "text-lg mt-2" : "text-base", categoryLabel && !isCarousel && "mt-2")}>
              {title}
            </p>
            {description && isPage && (
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p>
            )}
            <div className={cn("flex items-center gap-3", (description || duration) && "mt-2")}>
              {duration && !isCarousel && <p className="text-sm text-slate-500">{duration}</p>}
              {stepCountLabel && isPage && <span className="text-xs text-slate-400">{stepCountLabel} steps</span>}
            </div>
          </div>
        </div>
        <TutorialVideoDialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          duration={duration}
          videoUrl={videoUrl}
        />
      </>
    );
  }

  if (hasSopContent) {
    const visibleSopLines = isPage ? sopLines : sopLines.slice(0, 4);
    const sopPanel = (
      <div
        className={cn(
          "bg-gradient-to-br from-orange-50 via-white to-slate-50 border-b border-orange-100/80",
          isCarousel ? "aspect-video p-4 flex flex-col" : isPage ? "p-5 max-h-[280px] overflow-y-auto" : "h-44 p-3 overflow-y-auto",
        )}
      >
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-600 mb-2">
          <ClipboardList className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Standard operating procedure
        </p>
        <ol
          className={cn(
            "list-decimal list-inside space-y-1.5 text-slate-700 marker:text-orange-500/80",
            isPage ? "text-sm leading-relaxed" : "text-xs leading-snug",
          )}
        >
          {visibleSopLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        {!isPage && sopLines.length > 4 && (
          <p className="text-[10px] text-slate-400 mt-2">+{sopLines.length - 4} more steps</p>
        )}
      </div>
    );

    const sopCard = (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm h-full flex flex-col">
        {sopPanel}
        <div className={cn(isPage ? "p-6 flex-1 flex flex-col" : isCarousel ? "p-5" : "p-4")}>
          {categoryLabel && (
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded w-fit">
              {categoryLabel}
            </span>
          )}
          <p
            className={cn(
              "font-semibold text-slate-800",
              isCarousel ? "text-lg mt-2" : "text-base",
              categoryLabel && "mt-2",
            )}
          >
            {title}
          </p>
          {description && isPage && (
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p>
          )}
          {stepCountLabel && isPage && (
            <div className="mt-auto pt-4">
              <span className="text-xs text-slate-400">{stepCountLabel} steps</span>
            </div>
          )}
        </div>
      </div>
    );

    return sopCard;
  }

  const thumbnail = (
    <div className={cn(
      "relative overflow-hidden bg-slate-900",
      isCarousel ? "aspect-video" : isPage ? "h-44" : "h-44 sm:h-48 lg:h-52",
    )}>
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover opacity-90" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform",
            isCarousel ? "w-16 h-16" : "w-14 h-14",
          )}
        >
          <Play className={cn("text-orange-600 ml-0.5", isCarousel ? "w-7 h-7" : "w-6 h-6")} />
        </div>
      </div>
      {duration && (
        <span
          className={cn(
            "absolute bottom-3 right-3 bg-black/60 text-white font-medium px-2 py-1 rounded",
            isCarousel ? "text-sm" : "text-xs",
          )}
        >
          {duration}
        </span>
      )}
    </div>
  );

  const cardBody = (
    <>
      {thumbnail}
      <div className={cn(isPage ? "p-6" : isCarousel ? "p-5" : "p-4")}>
        {categoryLabel && (
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
            {categoryLabel}
          </span>
        )}
        <p className={cn("font-semibold text-slate-800", isCarousel ? "text-lg" : "text-base", categoryLabel && "mt-2")}>
          {title}
        </p>
        {description && isPage && (
          <p className="text-sm text-slate-500 mt-2 mb-4 leading-relaxed">{description}</p>
        )}
        {steps && isPage && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">{steps} steps</span>
            {duration && <span className="text-xs text-slate-400">{duration}</span>}
          </div>
        )}
      </div>
    </>
  );

  if (externalHref.startsWith("http")) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
      >
        {cardBody}
      </a>
    );
  }

  return (
    <Link
      href={externalHref}
      className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full"
    >
      {cardBody}
    </Link>
  );
}
