import { Paperclip, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SellermateChatAttachMenuProps = {
  disabled?: boolean;
  onAddPhotosAndFiles?: () => void;
};

export function SellermateChatAttachMenu({
  disabled,
  onAddPhotosAndFiles,
}: SellermateChatAttachMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
      >
        <DropdownMenuItem
          onClick={onAddPhotosAndFiles}
          className="gap-2.5 px-3 py-2.5 text-sm text-slate-700 cursor-pointer focus:bg-slate-50"
        >
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span>Add photos & files</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
