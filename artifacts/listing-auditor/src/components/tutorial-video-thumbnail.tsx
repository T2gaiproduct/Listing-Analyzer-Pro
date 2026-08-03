import { Play } from "lucide-react";
import { youtubePreviewEmbedUrl } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

type TutorialVideoThumbnailProps = {
  title: string;
  videoUrl: string;
  image?: string;
  duration?: string;
  onClick?: () => void;
  className?: string;
  aspectClassName?: string;
  playSize?: "sm" | "md" | "lg";
  showPreview?: boolean;
  playOverlayClassName?: string;
  interactive?: boolean;
};

export function TutorialVideoThumbnail({
  title,
  videoUrl,
  image,
  duration,
  onClick,
  className,
  aspectClassName = "aspect-video",
  playSize = "md",
  showPreview = true,
  playOverlayClassName,
  interactive = true,
}: TutorialVideoThumbnailProps) {
  const previewEmbedUrl = showPreview ? youtubePreviewEmbedUrl(videoUrl) : null;

  const playSizes = {
    sm: { shell: "w-12 h-12 sm:w-14 sm:h-14", icon: "w-5 h-5 sm:w-6 sm:h-6" },
    md: { shell: "w-14 h-14", icon: "w-6 h-6" },
    lg: { shell: "w-16 h-16", icon: "w-7 h-7" },
  }[playSize];

  const shellClass = cn(
    "group/thumb relative block w-full overflow-hidden bg-slate-900 text-left",
    interactive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
    aspectClassName,
    className,
  );

  const content = (
    <>
      {previewEmbedUrl ? (
        <iframe
          src={previewEmbedUrl}
          title={title}
          className="absolute inset-0 w-full h-full pointer-events-none scale-[1.4] origin-center"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={-1}
        />
      ) : image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover group-hover/thumb:scale-[1.02] transition-transform duration-500"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}

      <div
        className={cn(
          "absolute inset-0 transition-colors",
          previewEmbedUrl ? "bg-black/15 group-hover/thumb:bg-black/25" : "bg-black/20 group-hover/thumb:bg-black/30",
        )}
      />

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity",
          previewEmbedUrl ? "opacity-0 group-hover/thumb:opacity-100" : "opacity-100",
          playOverlayClassName,
        )}
      >
        <div
          className={cn(
            "rounded-full bg-white flex items-center justify-center shadow-md group-hover/thumb:scale-105 transition-transform",
            playSizes.shell,
          )}
        >
          <Play className={cn("fill-none stroke-orange-500 stroke-[2.5] ml-0.5", playSizes.icon)} />
        </div>
      </div>

      {duration && (
        <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-xs font-medium px-2 py-0.5 rounded-md pointer-events-none">
          {duration}
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Play video: ${title}`}
        className={shellClass}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={shellClass} aria-hidden="true">
      {content}
    </div>
  );
}
