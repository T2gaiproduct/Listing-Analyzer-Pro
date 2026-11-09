import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAdminAiSkills, type AiSkillRecord } from "@/lib/admin-ai-skills-api";
import {
  type GraphicsModuleExamplesPayload,
  useAdminProductCategories,
} from "@/lib/graphics-module-examples";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type CategoryCoverageRow = {
  category: string;
  contentSkillLabel: "Live" | "Draft" | "Missing";
  auditSkillLabel: "Live" | "Draft" | "Missing";
  imageSkillLabel: "Live" | "Draft" | "Missing";
  approvedRefCount: number;
  status: "ready" | "needs_setup";
};

function skillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
  types: AiSkillRecord["skillType"][],
  opts?: { includeMarketplaceContent?: boolean },
): "Live" | "Draft" | "Missing" {
  const scoped = skills.filter(
    (s) => s.category === category && types.includes(s.skillType),
  );
  if (scoped.some((s) => s.status === "published")) return "Live";
  if (scoped.some((s) => s.status === "draft")) return "Draft";

  if (opts?.includeMarketplaceContent && types.includes("product_content")) {
    const mp = skills.filter(
      (s) => s.skillKind === "marketplace_content" && s.skillType === "product_content",
    );
    if (mp.some((s) => s.status === "published")) return "Live";
    if (mp.some((s) => s.status === "draft")) return "Draft";
  }

  return "Missing";
}

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
  const { data: skillsData, isLoading: skillsLoading } = useAdminAiSkills();
  const { data: catData, isLoading: catLoading } = useAdminProductCategories();

  const skills = skillsData?.skills ?? [];
  const categories = catData?.categories ?? [];

  const categoryNames = useMemo(() => {
    const fromCatalog = categories.map((c) => c.name);
    const fromSkills = skills.map((s) => s.category).filter(Boolean);
    return [...new Set([...fromCatalog, ...fromSkills])].slice(0, 40);
  }, [categories, skills]);

  const exampleQueries = useQueries({
    queries: categoryNames.map((name) => ({
      queryKey: ["admin", "graphics-module-examples", "graphics", name],
      queryFn: () => fetchCategoryExamples(name),
      staleTime: 60_000,
    })),
  });

  const examplesLoading = exampleQueries.some((q) => q.isLoading);

  const coverageRows: CategoryCoverageRow[] = useMemo(() => {
    return categoryNames.map((category, idx) => {
      const examplesPayload = exampleQueries[idx]?.data;
      const approvedRefCount = examplesPayload ? countApprovedRefs(examplesPayload) : 0;

      const contentSkillLabel = skillStatusForCategory(skills, category, ["product_content"], {
        includeMarketplaceContent: true,
      });
      const imageSkillLabel = skillStatusForCategory(skills, category, [
        "product_images",
        "aplus_content",
      ]);
      let auditSkillLabel = skillStatusForCategory(skills, category, ["listing_audit"]);
      if (auditSkillLabel === "Missing") {
        auditSkillLabel = skillStatusForCategory(skills, "Default", ["listing_audit"]);
      }

      const ready =
        contentSkillLabel === "Live"
        && imageSkillLabel === "Live"
        && approvedRefCount >= 1;

      return {
        category,
        contentSkillLabel,
        auditSkillLabel,
        imageSkillLabel,
        approvedRefCount,
        status: ready ? "ready" : "needs_setup",
      };
    });
  }, [categoryNames, exampleQueries, skills]);

  const publishedSkills = skills.filter((s) => s.status === "published").length;
  const categoriesReady = coverageRows.filter((r) => r.status === "ready").length;
  const categoryTotal = coverageRows.length || 1;

  return {
    isLoading: skillsLoading || catLoading || examplesLoading,
    coverageRows,
    stats: {
      liveSkills: publishedSkills,
      totalSkills: skills.length,
      categoriesReady,
      categoryTotal,
    },
  };
}
