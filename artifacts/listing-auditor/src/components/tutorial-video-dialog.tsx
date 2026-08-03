import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { youtubeEmbedUrl } from "@/lib/video-embed";

export function TutorialVideoDialog({
  open,
  onOpenChange,
  title,
  duration,
  videoUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  duration?: string;
  videoUrl: string;
}) {
  const embedUrl = open && videoUrl ? youtubeEmbedUrl(videoUrl, { autoplay: true }) : null;

  if (!videoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden z-[200]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : open ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-full flex items-center justify-center text-sm font-medium text-white hover:bg-slate-900 transition-colors px-4 text-center"
            >
              Open video in new tab
            </a>
          ) : null}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 bg-white">
          <p className="font-semibold text-slate-900">{title}</p>
          {duration && <p className="text-sm text-slate-500 mt-0.5">{duration}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
