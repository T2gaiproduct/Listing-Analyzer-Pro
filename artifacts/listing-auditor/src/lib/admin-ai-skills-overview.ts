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

const IMAGE_SKILL_TYPES: AiSkillRecord["skillType"][] = ["product_images", "aplus_content"];

/** Match runtime: per-category custom skill, then Default, then global image-prompt templates. */
function imageSkillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
): "Live" | "Draft" | "Missing" {
  let label = skillStatusForCategory(skills, category, IMAGE_SKILL_TYPES);
  if (label === "Missing") {
    label = skillStatusForCategory(skills, "Default", IMAGE_SKILL_TYPES);
  }
  if (label !== "Missing") return label;

  const globalPrompts = skills.filter(
    (s) =>
      s.skillKind === "image_prompt"
      && IMAGE_SKILL_TYPES.includes(s.skillType)
      && !s.category?.trim(),
  );
  if (globalPrompts.some((s) => s.status === "published")) return "Live";
  if (globalPrompts.some((s) => s.status === "draft")) return "Draft";
  return "Missing";
}

/** Match runtime resolver: category, Default, empty category, then any published audit skill. */
function auditSkillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
): "Live" | "Draft" | "Missing" {
  let label = skillStatusForCategory(skills, category, ["listing_audit"]);
  if (label === "Missing") {
    label = skillStatusForCategory(skills, "Default", ["listing_audit"]);
  }
  if (label !== "Missing") return label;

  const unscoped = skills.filter(
    (s) => s.skillType === "listing_audit" && !s.category?.trim(),
  );
  if (unscoped.some((s) => s.status === "published")) return "Live";
  if (unscoped.some((s) => s.status === "draft")) return "Draft";

  const anyAudit = skills.filter((s) => s.skillType === "listing_audit");
  if (anyAudit.some((s) => s.status === "published")) return "Live";
  if (anyAudit.some((s) => s.status === "draft")) return "Draft";
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
      const imageSkillLabel = imageSkillStatusForCategory(skills, category);
      const auditSkillLabel = auditSkillStatusForCategory(skills, category);

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
