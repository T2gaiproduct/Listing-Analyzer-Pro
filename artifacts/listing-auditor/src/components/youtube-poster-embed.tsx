import { useState } from "react";
import { Play } from "lucide-react";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/video-embed";
import { cn } from "@/lib/utils";

type YoutubePosterEmbedProps = {
  videoUrl: string;
  title: string;
  className?: string;
  posterClassName?: string;
  posterUrl?: string;
};

/** Poster + play button; iframe loads only after click (LCP / INP friendly). */
export function YoutubePosterEmbed({
  videoUrl,
  title,
  className,
  posterClassName,
  posterUrl,
}: YoutubePosterEmbedProps) {
  const [active, setActive] = useState(false);
  const embedUrl = youtubeEmbedUrl(videoUrl, { autoplay: true });
  const thumb = posterUrl || youtubeThumbnailUrl(videoUrl);

  if (active && embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        className={cn("w-full h-full border-0", className)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className={cn(
        "relative w-full h-full group bg-slate-900 text-left overflow-hidden",
        className,
      )}
      aria-label={`Play video: ${title}`}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className={cn("absolute inset-0 w-full h-full object-cover", posterClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Play className="w-6 h-6 text-orange-600 ml-0.5" />
        </div>
      </div>
    </button>
  );
}
