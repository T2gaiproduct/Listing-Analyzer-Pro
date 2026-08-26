import { Paperclip, Plus } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MEMORY_FILE_ACCEPT } from "@/lib/sellermate-memory-upload";
import { cn } from "@/lib/utils";

type SellermateChatAttachMenuProps = {
  disabled?: boolean;
  disabledReason?: string;
  onFileSelected?: (file: File) => void;
};

export function SellermateChatAttachMenu({
  disabled,
  disabledReason,
  onFileSelected,
}: SellermateChatAttachMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  function openSystemFilePicker() {
    setOpen(false);
    window.setTimeout(() => inputRef.current?.click(), 100);
  }

  const attachButton = (
    <button
      type="button"
      disabled={disabled}
      aria-label="Add photos and files"
      className={cn(
        "w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50",
        "disabled:opacity-40 disabled:pointer-events-none",
        "data-[state=open]:bg-slate-50",
      )}
    >
      <Plus className="w-4 h-4" />
    </button>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={MEMORY_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected?.(file);
          event.target.value = "";
        }}
      />
      {disabled && disabledReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{attachButton}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {disabledReason}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{attachButton}</DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="z-[60] w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                openSystemFilePicker();
              }}
              className="gap-2.5 px-3 py-2.5 text-sm text-slate-700 cursor-pointer focus:bg-slate-50"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
              <span>Add photos & files</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
