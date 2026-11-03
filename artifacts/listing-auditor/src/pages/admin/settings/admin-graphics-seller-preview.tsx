import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GraphicsStudioReferencePicker } from "@/components/graphics-studio-reference-picker";
import { ChatGptStyleGenerationInput } from "@/components/chatgpt-style-generation-input";
import { DEFAULT_IMAGE_TYPE_PROMPT_CONFIG } from "@/components/graphics-output-options";
import type { ImagePromptTemplateAdmin } from "@/lib/image-prompt-templates";
import { useAdminGraphicsModuleExamples } from "@/lib/graphics-module-examples";

type Props = {
  productCategory: string;
  template: ImagePromptTemplateAdmin | null;
};

export function AdminGraphicsSellerPreview({ productCategory, template }: Props) {
  const categoryKey = productCategory.trim() || "Default";
  const { data: examplesPayload, isLoading } = useAdminGraphicsModuleExamples(categoryKey);

  const moduleExample = useMemo(() => {
    if (!template || template.slug === "custom") return null;
    return examplesPayload?.examples.find((e) => e.templateSlug === template.slug) ?? null;
  }, [examplesPayload?.examples, template]);

  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
        <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Seller preview</p>
        <p className="text-xs text-slate-500 mt-1">Select a graphics type to see what sellers see in Customize.</p>
      </div>
    );
  }

  if (!template.enabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-700" />
          <p className="text-sm font-semibold text-amber-950">Seller preview</p>
        </div>
        <p className="text-xs text-amber-900">
          <strong>{template.name}</strong> is disabled — sellers will not see this type in Create Graphics until
          you enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-orange-600 shrink-0" />
          <p className="text-sm font-semibold text-slate-900 truncate">Seller preview</p>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
          Create Graphics → Customize
        </Badge>
      </div>

      <div className="p-4 space-y-4 max-h-[min(70vh,640px)] overflow-y-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{template.metadata?.icon ?? "✨"}</span>
            <p className="text-base font-semibold text-slate-900">{template.name}</p>
          </div>
          {template.description ? (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          ) : null}
        </div>

        {template.slug !== "custom" ? (
          <GraphicsStudioReferencePicker
            moduleLabel={template.name}
            resolvedCategory={examplesPayload?.resolvedCategory ?? categoryKey}
            usedDefaultFallback={examplesPayload?.usedDefaultFallback ?? false}
            exampleImages={moduleExample?.exampleImages ?? []}
            referenceImages={referenceImages}
            onReferenceImagesChange={setReferenceImages}
            isLoading={isLoading}
          />
        ) : null}

        <div className="pointer-events-none opacity-90">
          <ChatGptStyleGenerationInput
            customPrompt=""
            onCustomPromptChange={() => {}}
            referenceImages={referenceImages}
            onReferenceImagesChange={() => {}}
            aspectRatio={DEFAULT_IMAGE_TYPE_PROMPT_CONFIG.aspectRatio}
            onAspectRatioChange={() => {}}
            quality={DEFAULT_IMAGE_TYPE_PROMPT_CONFIG.quality}
            onQualityChange={() => {}}
            placeholder="Optional — scene, lighting, composition, and mood…"
            flatSurface
          />
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          Preview only — changes here are not saved. Category: <span className="font-medium">{categoryKey}</span>
        </p>
      </div>
    </div>
  );
}
