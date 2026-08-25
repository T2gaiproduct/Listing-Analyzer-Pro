import { FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatAttachmentPreviewItem = {
  id: string;
  filename: string;
  previewUrl: string | null;
  uploadStatus: "uploading" | "done" | "error";
};

type SellermateChatAttachmentPreviewProps = {
  attachments: ChatAttachmentPreviewItem[];
  onRemove: (id: string) => void;
  className?: string;
};

export function SellermateChatAttachmentPreview({
  attachments,
  onRemove,
  className,
}: SellermateChatAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 pb-2", className)}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={cn(
            "relative shrink-0 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden",
            attachment.previewUrl ? "w-16 h-16" : "max-w-[200px] h-10 px-2.5",
          )}
        >
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center gap-1.5 min-w-0">
              <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-700 truncate">{attachment.filename}</span>
            </div>
          )}

          {attachment.uploadStatus === "uploading" && (
            <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}

          {attachment.uploadStatus === "error" && (
            <div className="absolute inset-x-0 bottom-0 bg-red-600/90 text-[9px] text-white text-center py-0.5">
              Failed
            </div>
          )}

          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            aria-label={`Remove ${attachment.filename}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
