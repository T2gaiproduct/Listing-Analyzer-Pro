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

const menuOptions = [
  { icon: FilePlus2, label: "Open" },
  { icon: Share2, label: "Share on WhatsApp" },
  { icon: Share2, label: "Share on Instagram" },
  { icon: Share2, label: "Share" },
  { icon: PenLine, label: "Rename" },
  { icon: Pin, label: "Pin project" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete", danger: true },
];

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
  const dotsRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (!(e.target as Element)?.closest?.("[data-recent-project-menu]")) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function shareUrl() {
    return `${window.location.origin}${basePath}${item.url.startsWith("/") ? item.url : `/${item.url}`}`;
  }

  function handleAction(label: string) {
    setMenuOpen(false);
    if (label === "Open") { navigate(item.url); return; }
    if (label === "Share") {
      void copyProjectShareLink({ projectTitle: item.name, shareUrl: shareUrl(), toast });
      return;
    }
    if (label === "Share on WhatsApp") {
      void shareProjectToWhatsApp({ projectTitle: item.name, shareUrl: shareUrl() });
      return;
    }
    if (label === "Share on Instagram") {
      void shareProjectToInstagram({ projectTitle: item.name, shareUrl: shareUrl(), toast });
      return;
    }
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
          if (menuOpen) { setMenuOpen(false); return; }
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
          {menuOptions.map(({ icon: Icon, label, danger }) => (
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
              {label === "Pin project" ? (item.pinned ? "Unpin" : "Pin project") : label}
            </button>
          ))}
        </div>,
        document.body,
      )}
      {dialog}
    </>
  );
}
