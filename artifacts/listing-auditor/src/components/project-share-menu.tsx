import { useState, useRef, useEffect } from "react";
import { Copy, Link2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  buildProjectShareUrl,
  buildShareMessage,
  copyShareMessage,
  openWhatsAppShare,
  shareToInstagram,
  type ProjectShareContext,
} from "@/lib/project-share";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export interface ProjectShareMenuProps {
  projectCtx?: ProjectShareContext | null;
  projectTitle?: string;
  shareUrlOverride?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  onShared?: () => void;
}

export function ProjectShareMenu({
  projectCtx = null,
  projectTitle,
  shareUrlOverride,
  buttonClassName,
  align = "right",
  onShared,
}: ProjectShareMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const shareUrl = shareUrlOverride
    ?? buildProjectShareUrl(window.location.origin, basePath, projectCtx ?? null);
  const shareMessage = buildShareMessage(projectTitle, shareUrl);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function handleCopy() {
    try {
      await copyShareMessage(shareMessage);
      toast({ title: "Link copied", description: "Project link copied to clipboard." });
      setOpen(false);
      onShared?.();
    } catch {
      toast({ title: "Copy failed", description: "Could not copy the link.", variant: "destructive" });
    }
  }

  function handleWhatsApp() {
    openWhatsAppShare(shareMessage);
    setOpen(false);
    onShared?.();
  }

  async function handleInstagram() {
    try {
      await shareToInstagram(shareMessage);
      toast({
        title: "Ready for Instagram",
        description: "Link copied — paste it in a DM or Story on Instagram.",
      });
      setOpen(false);
      onShared?.();
    } catch {
      toast({ title: "Could not copy link", description: "Please copy the URL manually.", variant: "destructive" });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Share"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors",
          open && "text-slate-700 bg-slate-100",
          buttonClassName,
        )}
      >
        <Share2 className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
            Share project
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <WhatsAppIcon className="w-4 h-4 text-[#25D366] flex-shrink-0" />
            WhatsApp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleInstagram()}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <InstagramIcon className="w-4 h-4 text-[#E4405F] flex-shrink-0" />
            Instagram
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopy()}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
          >
            <Copy className="w-4 h-4 text-slate-400 flex-shrink-0" />
            Copy link
          </button>
          <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-start gap-1.5">
            <Link2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Recipients must sign in to open shared projects.
          </p>
        </div>
      )}
    </div>
  );
}

/** Programmatic share helpers for sidebar context menu. */
export async function shareProjectToWhatsApp(opts: {
  projectTitle?: string;
  shareUrl: string;
}): Promise<void> {
  openWhatsAppShare(buildShareMessage(opts.projectTitle, opts.shareUrl));
}

export async function shareProjectToInstagram(opts: {
  projectTitle?: string;
  shareUrl: string;
  toast: (t: { title: string; description?: string; variant?: "destructive" }) => void;
}): Promise<void> {
  await shareToInstagram(buildShareMessage(opts.projectTitle, opts.shareUrl));
  opts.toast({
    title: "Ready for Instagram",
    description: "Link copied — paste it in a DM or Story on Instagram.",
  });
}

export async function copyProjectShareLink(opts: {
  projectTitle?: string;
  shareUrl: string;
  toast: (t: { title: string; description?: string; variant?: "destructive" }) => void;
}): Promise<void> {
  await copyShareMessage(buildShareMessage(opts.projectTitle, opts.shareUrl));
  opts.toast({ title: "Link copied", description: "Project link copied to clipboard." });
}
