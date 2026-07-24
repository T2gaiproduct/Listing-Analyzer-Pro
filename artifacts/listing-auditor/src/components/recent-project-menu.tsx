import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  FilePlus2,
  Share2,
  PenLine,
  Pin,
  Archive,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  Copy,
} from "lucide-react";
import { useActionDialog } from "@/components/ui/action-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  copyProjectShareLink,
  shareProjectToInstagram,
  shareProjectToWhatsApp,
} from "@/components/project-share-menu";
import type { RecentItem } from "@workspace/api-client-react";

export interface EnrichedRecentItem extends RecentItem {
  typeLabel?: string;
  imageUrl?: string | null;
  score?: number | null;
  category?: string | null;
  updatedAt?: string | Date;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const menuOptions: Array<{
  icon: typeof FilePlus2;
  label: string;
  danger?: boolean;
  share?: boolean;
}> = [
  { icon: FilePlus2, label: "Open" },
  { icon: Share2, label: "Share", share: true },
  { icon: PenLine, label: "Rename" },
  { icon: Pin, label: "Pin project" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete", danger: true },
];

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

export function RecentProjectMenu({
  item,
  onPin,
  onRename,
  onArchive,
  onDelete,
  buttonClassName,
}: {
  item: EnrichedRecentItem;
  onPin: () => void;
  onRename: (name: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  buttonClassName?: string;
}) {
  const [, navigate] = useLocation();
  const { trigger, dialog } = useActionDialog();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (!(e.target as Element)?.closest?.("[data-recent-project-menu]")) {
        setMenuOpen(false);
        setShareOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setShareOpen(false);
  }

  function shareUrl() {
    return `${window.location.origin}${basePath}${item.url.startsWith("/") ? item.url : `/${item.url}`}`;
  }

  function handleAction(label: string) {
    if (label === "Share") {
      setShareOpen(true);
      return;
    }
    closeMenu();
    if (label === "Open") { navigate(item.url); return; }
    if (label === "Pin project") { onPin(); return; }
    if (label === "Rename") {
      trigger(
        async (name) => { await onRename(name); },
        {
          title: "Rename Project",
          description: "Enter a new name for this project.",
          confirmLabel: "Rename",
          successTitle: "Renamed!",
          successDescription: "Your project has been renamed successfully.",
          inputField: { label: "Project name", placeholder: "Enter name…", defaultValue: item.name },
        },
      );
      return;
    }
    if (label === "Archive") {
      trigger(
        async () => { await onArchive(); },
        {
          title: "Archive this project?",
          description: "It will be moved to your Archive. You can restore it anytime.",
          confirmLabel: "Archive",
          successTitle: "Archived!",
          successDescription: "Your project has been moved to the Archive.",
        },
      );
      return;
    }
    if (label === "Delete") {
      trigger(
        async () => { await onDelete(); },
        {
          title: "Delete this project?",
          description: "This action cannot be undone.",
          confirmLabel: "Delete",
          confirmVariant: "destructive",
          successTitle: "Deleted",
          successDescription: "Your project has been permanently deleted.",
        },
      );
    }
  }

  function handleShareAction(action: "whatsapp" | "instagram" | "copy") {
    closeMenu();
    if (action === "whatsapp") {
      void shareProjectToWhatsApp({ projectTitle: item.name, shareUrl: shareUrl() });
      return;
    }
    if (action === "instagram") {
      void shareProjectToInstagram({ projectTitle: item.name, shareUrl: shareUrl(), toast });
      return;
    }
    void copyProjectShareLink({ projectTitle: item.name, shareUrl: shareUrl(), toast });
  }

  return (
    <>
      <button
        ref={dotsRef}
        type="button"
        title="More options"
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors",
          buttonClassName,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (menuOpen) { closeMenu(); return; }
          const rect = dotsRef.current?.getBoundingClientRect();
          if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
          setMenuOpen(true);
        }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {menuOpen && menuPos && createPortal(
        <div
          data-recent-project-menu
          style={{ position: "fixed", top: menuPos.top, left: Math.max(4, menuPos.left), zIndex: 9999 }}
          className="w-44 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden py-1"
        >
          {shareOpen ? (
            <>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                onClick={(e) => { e.stopPropagation(); setShareOpen(false); }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                onClick={(e) => { e.stopPropagation(); handleShareAction("whatsapp"); }}
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" />
                WhatsApp
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                onClick={(e) => { e.stopPropagation(); handleShareAction("instagram"); }}
              >
                <InstagramIcon className="w-3.5 h-3.5 text-[#E4405F] flex-shrink-0" />
                Instagram
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                onClick={(e) => { e.stopPropagation(); handleShareAction("copy"); }}
              >
                <Copy className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                Copy link
              </button>
            </>
          ) : (
            menuOptions.map(({ icon: Icon, label, danger, share }) => (
              <button
                key={label}
                type="button"
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                  danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50",
                )}
                onClick={(e) => { e.stopPropagation(); handleAction(label); }}
              >
                <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", danger ? "text-red-500" : "text-slate-400")} />
                <span className="flex-1">
                  {label === "Pin project" ? (item.pinned ? "Unpin" : "Pin project") : label}
                </span>
                {share && <ChevronLeft className="w-3 h-3 rotate-180 text-slate-300" />}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
      {dialog}
    </>
  );
}
