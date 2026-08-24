import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  MEMORY_FILE_ACCEPT as MEMORY_UPLOAD_ACCEPT,
  memoryFileToBase64,
  titleFromMemoryFilename,
} from "@/lib/sellermate-memory-upload";

export { MEMORY_UPLOAD_ACCEPT };

const MEMORY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = MEMORY_UPLOAD_ACCEPT.split(",").map((ext) => ext.trim().toLowerCase());

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function isAllowedFile(file: File): boolean {
  return ALLOWED_EXTENSIONS.includes(fileExtension(file.name));
}

function titleFromFilename(filename: string): string {
  return titleFromMemoryFilename(filename);
}

async function fileToBase64(file: File): Promise<string> {
  return memoryFileToBase64(file);
}

export type UploadMemoryFileInput = {
  name: string;
  description?: string;
  filename: string;
  fileBase64: string;
};

type UploadMemoryFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (input: UploadMemoryFileInput) => Promise<void>;
  isUploading?: boolean;
};

export function UploadMemoryFileDialog({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
}: UploadMemoryFileDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const openedAtRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [description, setDescription] = useState("");

  const reset = useCallback(() => {
    setSelectedFile(null);
    setDragActive(false);
    setError(null);
    setDocumentTitle("");
    setDescription("");
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
    }
  }, [open]);

  const openFilePicker = () => {
    if (Date.now() - openedAtRef.current < 400) return;
    inputRef.current?.click();
  };

  const applyFile = (file: File | null) => {
    if (!file) return;
    if (!isAllowedFile(file)) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > MEMORY_UPLOAD_MAX_BYTES) {
      setError("File exceeds 10 MB limit.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (!documentTitle.trim()) {
      setDocumentTitle(titleFromFilename(file.name));
    }
  };

  const canUpload = useMemo(
    () => Boolean(selectedFile && documentTitle.trim() && !isUploading),
    [selectedFile, documentTitle, isUploading],
  );

  const handleUpload = async () => {
    if (!selectedFile || !documentTitle.trim()) return;
    try {
      const fileBase64 = await fileToBase64(selectedFile);
      await onUpload({
        name: documentTitle.trim(),
        description: description.trim() || undefined,
        filename: selectedFile.name,
        fileBase64,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.setTimeout(() => titleInputRef.current?.focus(), 0);
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogTitle className="text-base font-semibold">Upload Memory File</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <div
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openFilePicker();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0] ?? null;
              applyFile(file);
            }}
            className={cn(
              "rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
              dragActive
                ? "border-emerald-700 bg-emerald-50/50"
                : "border-emerald-800/70 hover:bg-slate-50",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={MEMORY_UPLOAD_ACCEPT}
              className="hidden"
              onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-slate-500" />
                <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB — click or drop to replace
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="w-3 h-3" />
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-700">Drag &amp; drop or click to browse</p>
                <p className="text-[11px] leading-relaxed text-slate-500 max-w-sm">
                  CSV, XLSX, XLS, MD, TXT, DOC, DOCX — max 10 MB — max 25k tokens — max 50k rows — max 400 columns
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="memory-document-title" className="text-sm font-medium text-slate-800">
              Document Title <span className="text-red-500">*</span>
            </Label>
            <Input
              ref={titleInputRef}
              id="memory-document-title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Document Title *"
              className="h-10"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Name it descriptively so the AI Agent can find the right file. e.g. &quot;Group Pharma Brand Voice Guide&quot; or &quot;ABC Corp Competitor Analysis Q1&quot;
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memory-description" className="text-sm font-medium text-slate-800">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="memory-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="min-h-[72px] resize-none"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Brief summary of what&apos;s in the file — helps the AI Agent decide whether to read it.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!canUpload}
            className="bg-emerald-800 hover:bg-emerald-900 text-white min-w-[100px]"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
