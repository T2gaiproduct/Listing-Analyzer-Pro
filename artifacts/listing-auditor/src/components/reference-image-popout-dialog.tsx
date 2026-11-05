import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProtectedAppImage } from "@/components/protected-app-image";

type Props = {
  src: string | null;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReferenceImagePopoutDialog({ src, alt = "Reference preview", open, onOpenChange }: Props) {
  const trimmed = src?.trim() ?? "";
  const isDataOrBlob = trimmed.startsWith("data:") || trimmed.startsWith("blob:");

  return (
    <Dialog open={open && Boolean(trimmed)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[min(100vw-1rem,64rem)] p-2 sm:p-4 border-0 bg-transparent shadow-none">
        {trimmed ? (
          <div className="relative">
            {isDataOrBlob ? (
              <img
                src={trimmed}
                alt={alt}
                className="w-full max-h-[85vh] object-contain rounded-xl bg-black/20 mx-auto"
              />
            ) : (
              <ProtectedAppImage
                src={trimmed}
                alt={alt}
                className="w-full max-h-[85vh] object-contain rounded-xl bg-black/20 mx-auto"
                loading="eager"
              />
            )}
            <button
              type="button"
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
              onClick={() => onOpenChange(false)}
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
