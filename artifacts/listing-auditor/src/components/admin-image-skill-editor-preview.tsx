import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ProtectedAppImage } from "@/components/protected-app-image";
import { useAdminGraphicsModuleExamples } from "@/lib/graphics-module-examples";
import { useAdminImagePromptTemplates } from "@/lib/image-prompt-templates";
import type { ImagePromptTemplateCategory } from "@/lib/image-prompt-templates";

type Props = {
  instructionsText: string;
  category: string;
  templateSlug?: string | null;
  templateCategory?: ImagePromptTemplateCategory;
};

export function AdminImageSkillEditorPreview({
  instructionsText: _instructionsText,
  category,
  templateSlug,
  templateCategory = "graphics",
}: Props) {
  const cat = category.trim();

  const { data: examplesData, isLoading: examplesLoading } = useAdminGraphicsModuleExamples(
    cat || null,
    templateCategory,
    { enabled: Boolean(cat) },
  );
  const { data: templatesData } = useAdminImagePromptTemplates(templateCategory);

  const cards = useMemo(() => {
    const examples = examplesData?.examples ?? [];
    const templates = templatesData?.templates?.filter((t) => t.enabled) ?? [];
    const bySlug = new Map(examples.map((e) => [e.templateSlug, e]));

    const source = templateSlug
      ? templates.filter((t) => t.slug === templateSlug)
      : templates;

    return source.map((t) => {
      const ex = bySlug.get(t.slug);
      const url =
        ex?.exampleImages?.[0]?.url
        ?? ex?.exampleImageUrl
        ?? null;
      return {
        slug: t.slug,
        name: t.name,
        icon: t.metadata?.icon ?? "🖼️",
        url,
      };
    });
  }, [examplesData?.examples, templateSlug, templatesData?.templates]);

  return (
    <div className="space-y-4 flex-1">
      {!cat ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Select a configured category above to load reference previews.
        </p>
      ) : examplesLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading category references…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div
              key={card.slug}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
            >
              <div className="aspect-square relative bg-slate-100 flex items-center justify-center">
                {card.url ? (
                  <ProtectedAppImage
                    src={card.url}
                    alt={card.name}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <span className="text-4xl opacity-30">{card.icon}</span>
                )}
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-slate-800/75 text-white text-[10px] px-2 py-0.5">
                  Preview
                </span>
              </div>
              <p className="text-sm font-medium text-center py-2 text-slate-800">{card.name}</p>
            </div>
          ))}
        </div>
      )}

      {cards.length === 0 && !examplesLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No graphics types found. Publish this skill or add templates under Graphics image prompts.
        </p>
      )}

      {cat && (
      <p className="text-[11px] text-muted-foreground">
        Previews use reference images for <strong>{cat}</strong>
        {templateSlug ? ` · ${templateSlug}` : ""}. Use <strong>Reference images</strong> above to upload per
        category, or{" "}
        <a href="/admin/settings/ai/overview" className="text-orange-600 underline">
          Overview → category row
        </a>
        .
      </p>
      )}
    </div>
  );
}
