import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedAppImage } from "@/components/protected-app-image";
import { ReferenceImageUploadField } from "@/components/reference-image-upload-field";
import type { GraphicsImageTypeOption } from "@/components/graphics-type-customize-ui";
import { resolveGraphicsRecordLabel } from "@/lib/graphics-display-label";
import type { ImageRecord } from "@workspace/api-client-react";
import { Clock, Download, RefreshCw, Wand2 } from "lucide-react";

type Props = {
  imageTypes: GraphicsImageTypeOption[];
  editRecord: ImageRecord | null;
  onEditOpenChange: (open: boolean) => void;
  editPrompt: string;
  onEditPromptChange: (v: string) => void;
  editReferenceImages: string[];
  onEditReferenceImagesChange: (v: string[]) => void;
  editLoading: boolean;
  onEditSubmit: () => void;
  historyRecord: ImageRecord | null;
  onHistoryOpenChange: (open: boolean) => void;
  onDownload: (url: string, filename: string) => void;
  onRestoreVersion: (record: ImageRecord, versionUrl: string) => void;
  restorePending: boolean;
  fullscreenUrl: string | null;
  onFullscreenClose: () => void;
};

export function GraphicsWizardImageDialogs({
  imageTypes,
  editRecord,
  onEditOpenChange,
  editPrompt,
  onEditPromptChange,
  editReferenceImages,
  onEditReferenceImagesChange,
  editLoading,
  onEditSubmit,
  historyRecord,
  onHistoryOpenChange,
  onDownload,
  onRestoreVersion,
  restorePending,
  fullscreenUrl,
  onFullscreenClose,
}: Props) {
  return (
    <>
      <Dialog open={!!editRecord} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit Image with AI
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Current</p>
                  <div className="rounded-lg border bg-slate-50 aspect-square overflow-hidden">
                    <ProtectedAppImage src={editRecord.currentUrl} alt="Current" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">After (shown on apply)</p>
                  <div className="rounded-lg border bg-slate-50/50 aspect-square flex flex-col items-center justify-center gap-3 text-slate-400">
                    {editLoading ? (
                      <>
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
                          <Wand2 className="absolute inset-0 m-auto h-5 w-5 text-orange-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 text-center px-4">Generating edit…</p>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-7 w-7 opacity-20" />
                        <span className="text-xs text-center px-4">Result appears here after applying</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Instructions</label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => onEditPromptChange(e.target.value)}
                  placeholder="e.g. Soften callout text, adjust arrow colors…"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <ReferenceImageUploadField
                images={editReferenceImages}
                onImagesChange={onEditReferenceImagesChange}
                label="Reference images (optional)"
                hint="Upload style or content references to guide the edit."
              />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => onEditOpenChange(false)} disabled={editLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={onEditSubmit}
                  disabled={!editPrompt.trim() || editLoading}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {editLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {editLoading ? "Applying…" : "Apply Edit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyRecord} onOpenChange={onHistoryOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Version History
              {historyRecord && (
                <span className="text-slate-500 font-normal text-sm">
                  - {resolveGraphicsRecordLabel(historyRecord, imageTypes)} {historyRecord.index + 1}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {historyRecord && (
            <div className="space-y-4">
              {historyRecord.versions.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No version history yet.</p>
                  <p className="text-xs">Regenerate or edit this image to start tracking versions.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
                  {[...historyRecord.versions].reverse().map((v, i) => (
                    <div key={`${v.url}-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white">
                      <div className="w-16 h-16 rounded-lg border bg-slate-50 overflow-hidden flex-shrink-0">
                        <ProtectedAppImage src={v.url} alt={`Version ${i + 1}`} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {v.isEdit ? "Edit" : "Generate"}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {new Date(v.generatedAt).toLocaleString()}
                          </span>
                        </div>
                        {v.prompt ? <p className="text-xs text-slate-500 mt-1 truncate">{v.prompt}</p> : null}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {v.url === historyRecord.currentUrl ? (
                          <Badge variant="secondary" className="text-[10px] justify-center">
                            Current
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px]"
                            disabled={restorePending}
                            onClick={() => onRestoreVersion(historyRecord, v.url)}
                          >
                            Use this version
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => onDownload(v.url, `version_${historyRecord.versions.length - i}.png`)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullscreenUrl} onOpenChange={(open) => !open && onFullscreenClose()}>
        <DialogContent className="max-w-5xl p-1">
          {fullscreenUrl ? (
            <ProtectedAppImage
              src={fullscreenUrl}
              alt="Full screen preview"
              className="w-full max-h-[85vh] object-contain rounded-lg"
              loading="eager"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
