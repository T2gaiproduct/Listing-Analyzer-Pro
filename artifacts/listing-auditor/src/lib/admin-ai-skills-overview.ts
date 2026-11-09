import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAdminContentMarketplaces } from "@/lib/content-marketplaces";
import { useAdminImagePromptTemplates } from "@/lib/image-prompt-templates";
import {
  type GraphicsModuleExamplesPayload,
  useAdminProductCategories,
} from "@/lib/graphics-module-examples";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type CategoryCoverageRow = {
  category: string;
  contentSkillLabel: string;
  imageSkillLabel: "Live" | "Draft" | "Missing";
  approvedRefCount: number;
  status: "ready" | "needs_setup";
};

async function fetchCategoryExamples(category: string): Promise<GraphicsModuleExamplesPayload> {
  const res = await fetch(
    `${basePath}/api/admin/graphics-module-examples?category=${encodeURIComponent(category)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load examples");
  return res.json() as Promise<GraphicsModuleExamplesPayload>;
}

function countApprovedRefs(payload: GraphicsModuleExamplesPayload): number {
  return payload.examples.reduce((sum, ex) => {
    const imgs = ex.exampleImages?.length
      ? ex.exampleImages.length
      : ex.exampleImageUrl
        ? 1
        : 0;
    return sum + imgs;
  }, 0);
}

export function useAdminAiSkillsOverview() {
  const { data: mpData, isLoading: mpLoading } = useAdminContentMarketplaces();
  const { data: gfxData, isLoading: gfxLoading } = useAdminImagePromptTemplates("graphics");
  const { data: aplusData, isLoading: aplusLoading } = useAdminImagePromptTemplates("aplus");
  const { data: catData, isLoading: catLoading } = useAdminProductCategories();

  const marketplaces = mpData?.marketplaces ?? [];
  const graphicsTemplates = gfxData?.templates ?? [];
  const aplusTemplates = aplusData?.templates ?? [];
  const categories = catData?.categories ?? [];

  const enabledMarketplaces = marketplaces.filter((m) => m.enabled);
  const enabledGraphics = graphicsTemplates.filter((t) => t.enabled);
  const draftGraphics = graphicsTemplates.filter((t) => !t.enabled);
  const enabledAplus = aplusTemplates.filter((t) => t.enabled);

  const categoryNames = useMemo(
    () => categories.map((c) => c.name).slice(0, 40),
    [categories],
  );

  const exampleQueries = useQueries({
    queries: categoryNames.map((name) => ({
      queryKey: ["admin", "graphics-module-examples", "graphics", name],
      queryFn: () => fetchCategoryExamples(name),
      staleTime: 60_000,
    })),
  });

  const examplesLoading = exampleQueries.some((q) => q.isLoading);

  const coverageRows: CategoryCoverageRow[] = useMemo(() => {
    const globalContentLive = enabledMarketplaces.length;
    const globalImageLive = enabledGraphics.length > 0;
    const globalImageDraft = !globalImageLive && draftGraphics.length > 0;

    return categoryNames.map((category, idx) => {
      const examplesPayload = exampleQueries[idx]?.data;
      const approvedRefCount = examplesPayload ? countApprovedRefs(examplesPayload) : 0;

      const contentSkillLabel =
        globalContentLive > 0 ? `${globalContentLive} live` : "Missing";

      let imageSkillLabel: CategoryCoverageRow["imageSkillLabel"] = "Missing";
      if (globalImageLive) imageSkillLabel = "Live";
      else if (globalImageDraft) imageSkillLabel = "Draft";

      const hasContent = globalContentLive > 0;
      const hasLiveImage = imageSkillLabel === "Live";
      const hasEnoughRefs = approvedRefCount >= 1;
      const ready = hasContent && hasLiveImage && hasEnoughRefs;

      return {
        category,
        contentSkillLabel,
        imageSkillLabel,
        approvedRefCount,
        status: ready ? "ready" : "needs_setup",
      };
    });
  }, [
    categoryNames,
    enabledMarketplaces.length,
    draftGraphics.length,
    enabledGraphics.length,
    exampleQueries,
  ]);

  const liveSkillUnits =
    enabledMarketplaces.length
    + enabledGraphics.length
    + enabledAplus.length;

  const totalSkillUnits =
    marketplaces.length + graphicsTemplates.length + aplusTemplates.length;

  const categoriesReady = coverageRows.filter((r) => r.status === "ready").length;
  const categoryTotal = coverageRows.length || 1;

  return {
    isLoading: mpLoading || gfxLoading || aplusLoading || catLoading || examplesLoading,
    enabledMarketplaces,
    enabledGraphics,
    enabledAplus,
    graphicsTemplates,
    marketplaces,
    coverageRows,
    stats: {
      liveSkills: liveSkillUnits,
      totalSkills: totalSkillUnits,
      categoriesReady,
      categoryTotal,
    },
  };
}
