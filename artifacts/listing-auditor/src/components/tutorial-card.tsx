import { useState } from "react";
import { Link } from "wouter";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { youtubeEmbedUrl } from "@/lib/video-embed";
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
  categoryLabel,
  linkUrl,
  layout = "grid",
  fallbackHref = "/tutorials",
}: TutorialCardProps & { categoryLabel?: string }) {
  const [open, setOpen] = useState(false);
  const embedUrl = videoUrl ? youtubeEmbedUrl(videoUrl) : null;
  const hasVideo = Boolean(videoUrl?.trim());
  const isCarousel = layout === "carousel";
  const isPage = layout === "page";
  const externalHref = linkUrl?.trim() || fallbackHref;

  if (hasVideo && embedUrl) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm h-full flex flex-col">
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
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
            {duration && <p className="text-sm text-slate-500">{duration}</p>}
            {steps && isPage && <span className="text-xs text-slate-400">{steps} steps</span>}
          </div>
        </div>
      </div>
    );
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

  if (hasVideo) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full w-full text-left"
        >
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
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p>
            )}
          </div>
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <div className="aspect-video w-full bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-full flex items-center justify-center text-sm font-medium text-white hover:bg-slate-900 transition-colors px-4 text-center"
                >
                  Open video in new tab
                </a>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200">
              <p className="font-semibold text-slate-900">{title}</p>
              {duration && <p className="text-sm text-slate-500 mt-0.5">{duration}</p>}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

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
