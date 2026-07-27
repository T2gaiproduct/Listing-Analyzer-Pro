import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CustomPromptGenerationPanel,
  GRAPHICS_ASPECT_RATIOS,
  GRAPHICS_QUALITY_OPTIONS,
  type ImageTypePromptConfig,
} from "@/components/custom-prompt-generation-panel";

export type GraphicsImageTypeOption = {
  id: string;
  label: string;
  desc: string;
  icon: string;
};

type ImageTypeCustomizeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: GraphicsImageTypeOption | null;
  config: ImageTypePromptConfig;
  onConfigChange: (patch: Partial<ImageTypePromptConfig>) => void;
  promptMaxChars?: number;
  examplePrompts?: string[];
  hideAspectRatio?: boolean;
};

export function ImageTypeCustomizeDialog({
  open,
  onOpenChange,
  type,
  config,
  onConfigChange,
  promptMaxChars,
  examplePrompts,
  hideAspectRatio = false,
}: ImageTypeCustomizeDialogProps) {
  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] overflow-y-auto gap-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="text-xl leading-none">{type.icon}</span>
            {type.label}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{type.desc}</p>
        </DialogHeader>

        <CustomPromptGenerationPanel
          variant="embedded"
          customPrompt={config.customPrompt}
          onCustomPromptChange={(value) => onConfigChange({ customPrompt: value })}
          referenceImages={config.referenceImages}
          onReferenceImagesChange={(images) => onConfigChange({ referenceImages: images })}
          aspectRatio={config.aspectRatio}
          onAspectRatioChange={(ratio) => onConfigChange({ aspectRatio: ratio })}
          quality={config.quality}
          onQualityChange={(quality) => onConfigChange({ quality })}
          promptMaxChars={promptMaxChars}
          examplePrompts={examplePrompts}
          hideAspectRatio={hideAspectRatio}
        />

        <DialogFooter className="sm:justify-end gap-2">
          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SelectedGraphicsTypesSummaryProps = {
  imageTypes: GraphicsImageTypeOption[];
  selectedTypeIds: string[];
  getConfig: (typeId: string) => ImageTypePromptConfig;
  onEdit: (typeId: string) => void;
  onRemove: (typeId: string) => void;
  instructionText?: string;
  hideAspectRatio?: boolean;
};

export function SelectedGraphicsTypesSummary({
  imageTypes,
  selectedTypeIds,
  getConfig,
  onEdit,
  onRemove,
  instructionText = "Selected types — tap a row to customize prompt, uploads, and output settings.",
  hideAspectRatio = false,
}: SelectedGraphicsTypesSummaryProps) {
  if (selectedTypeIds.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">
        {instructionText}
      </p>
      <div className="space-y-2">
        {selectedTypeIds.map((typeId) => {
          const type = imageTypes.find((item) => item.id === typeId);
          if (!type) return null;
          const config = getConfig(typeId);
          const ratio = GRAPHICS_ASPECT_RATIOS.find((r) => r.value === config.aspectRatio);
          const quality = GRAPHICS_QUALITY_OPTIONS.find((q) => q.value === config.quality);
          const promptPreview = config.customPrompt.trim();

          return (
            <div
              key={typeId}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm"
            >
              <button
                type="button"
                onClick={() => onEdit(typeId)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-lg hover:bg-orange-50/60 px-1 py-0.5 transition-colors"
              >
                <span className="text-xl leading-none flex-shrink-0">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{type.label}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {promptPreview
                      ? promptPreview
                      : hideAspectRatio
                        ? `${quality?.label ?? config.quality} quality`
                        : `${ratio?.label ?? config.aspectRatio} · ${quality?.label ?? config.quality}`}
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-orange-600 font-medium flex-shrink-0">
                  <Settings2 className="w-3.5 h-3.5" />
                  Customize
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-red-600"
                aria-label={`Remove ${type.label}`}
                onClick={() => onRemove(typeId)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
