import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAiSkills, type AiSkillRecord } from "@/lib/admin-ai-skills-api";
import {
  PFA_BROWSE_CATEGORIES,
  browsePathSegments,
  filterAmazonBrowseCategories,
  leafLabelFromBrowsePath,
  topLevelBrowseDepartment,
} from "@/lib/amazon-browse-categories";
import { DEFAULT_CATEGORY_FOR_ADMIN as DEFAULT_GRAPHICS_PRODUCT_CATEGORY } from "@/lib/graphics-module-examples";

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

function bestSkillLabel(labels: Array<"Live" | "Draft" | "Missing">): "Live" | "Draft" | "Missing" {
  if (labels.includes("Live")) return "Live";
  if (labels.includes("Draft")) return "Draft";
  return "Missing";
}

function categorySkillKeys(browsePath: string): string[] {
  const leaf = leafLabelFromBrowsePath(browsePath);
  const top = topLevelBrowseDepartment(browsePath);
  const segs = browsePathSegments(browsePath);
  return [...new Set([browsePath, leaf, top, ...segs].filter(Boolean))];
}

function imageSkillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
): "Live" | "Draft" | "Missing" {
  const keys = categorySkillKeys(category);
  const fromCategory = bestSkillLabel(keys.map((k) => skillStatusForCategory(skills, k, IMAGE_SKILL_TYPES)));
  if (fromCategory !== "Missing") return fromCategory;

  let label = skillStatusForCategory(skills, DEFAULT_GRAPHICS_PRODUCT_CATEGORY, IMAGE_SKILL_TYPES);
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

function auditSkillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
): "Live" | "Draft" | "Missing" {
  const keys = categorySkillKeys(category);
  const fromCategory = bestSkillLabel(keys.map((k) => skillStatusForCategory(skills, k, ["listing_audit"])));
  if (fromCategory !== "Missing") return fromCategory;

  let label = skillStatusForCategory(skills, DEFAULT_GRAPHICS_PRODUCT_CATEGORY, ["listing_audit"]);
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

function contentSkillStatusForCategory(
  skills: AiSkillRecord[],
  category: string,
): "Live" | "Draft" | "Missing" {
  const keys = categorySkillKeys(category);
  return bestSkillLabel(
    keys.map((k) =>
      skillStatusForCategory(skills, k, ["product_content"], { includeMarketplaceContent: true }),
    ),
  );
}

export function buildCategoryCoverageRow(
  category: string,
  skills: AiSkillRecord[],
  approvedRefCount: number,
): CategoryCoverageRow {
  const contentSkillLabel = contentSkillStatusForCategory(skills, category);
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
}

async function fetchRefCounts(): Promise<Record<string, number>> {
  const res = await fetch(`${basePath}/api/admin/graphics-module-examples/ref-counts`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load reference counts");
  const body = (await res.json()) as { counts?: Record<string, number> };
  return body.counts ?? {};
}

export function useAllBrowseCategoryPaths(): string[] {
  return useMemo(() => {
    const fromPfa = PFA_BROWSE_CATEGORIES.map((c) => c.browsePath);
    const sorted = [...fromPfa].sort((a, b) => a.localeCompare(b));
    return [DEFAULT_GRAPHICS_PRODUCT_CATEGORY, ...sorted];
  }, []);
}

/** Same category universe as AI Overview coverage (PFA browse paths + Default), plus the current selection. */
export function adminSkillCategoryPickerOptions(
  browsePaths: string[],
  currentCategory?: string,
): string[] {
  const merged = new Set(browsePaths);
  const current = currentCategory?.trim();
  if (current) merged.add(current);
  const withoutDefault = [...merged].filter((n) => n !== DEFAULT_GRAPHICS_PRODUCT_CATEGORY);
  withoutDefault.sort((a, b) => a.localeCompare(b));
  return [DEFAULT_GRAPHICS_PRODUCT_CATEGORY, ...withoutDefault];
}

export type AdminAiSkillsOverviewOptions = {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
};

export function useAdminAiSkillsOverview(options: AdminAiSkillsOverviewOptions = {}) {
  const searchQuery = options.searchQuery ?? "";
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 12;

  const { data: skillsData, isLoading: skillsLoading } = useAdminAiSkills();
  const { data: refCounts = {}, isLoading: refCountsLoading } = useQuery({
    queryKey: ["admin", "graphics-module-examples", "ref-counts"],
    queryFn: fetchRefCounts,
    staleTime: 60_000,
  });

  const skills = skillsData?.skills ?? [];
  const allBrowsePaths = useAllBrowseCategoryPaths();

  const legacySkillCategories = useMemo(() => {
    return skills
      .map((s) => s.category?.trim())
      .filter((c): c is string => Boolean(c));
  }, [skills]);

  const fullCatalog = useMemo(() => {
    const extra = [...Object.keys(refCounts), ...legacySkillCategories];
    const merged = new Set(allBrowsePaths);
    for (const name of extra) {
      if (name) merged.add(name);
    }
    const withoutDefault = [...merged].filter((n) => n !== DEFAULT_GRAPHICS_PRODUCT_CATEGORY);
    withoutDefault.sort((a, b) => a.localeCompare(b));
    return [DEFAULT_GRAPHICS_PRODUCT_CATEGORY, ...withoutDefault];
  }, [allBrowsePaths, legacySkillCategories, refCounts]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return fullCatalog;

    const matchedBrowse = new Set(
      filterAmazonBrowseCategories(PFA_BROWSE_CATEGORIES, q, 500).map((c) => c.browsePath),
    );

    const qLower = q.toLowerCase();
    return fullCatalog.filter(
      (name) =>
        matchedBrowse.has(name)
        || name.toLowerCase().includes(qLower),
    );
  }, [fullCatalog, searchQuery]);

  const pagedCategories = useMemo(() => {
    const start = page * pageSize;
    return filteredCatalog.slice(start, start + pageSize);
  }, [filteredCatalog, page, pageSize]);

  const coverageRows: CategoryCoverageRow[] = useMemo(() => {
    return pagedCategories.map((category) =>
      buildCategoryCoverageRow(category, skills, refCounts[category] ?? 0),
    );
  }, [pagedCategories, skills, refCounts]);

  const stats = useMemo(() => {
    const publishedSkills = skills.filter((s) => s.status === "published").length;
    let categoriesReady = 0;
    for (const category of fullCatalog) {
      const row = buildCategoryCoverageRow(category, skills, refCounts[category] ?? 0);
      if (row.status === "ready") categoriesReady += 1;
    }
    return {
      liveSkills: publishedSkills,
      totalSkills: skills.length,
      categoriesReady,
      categoryTotal: fullCatalog.length || 1,
      filteredTotal: filteredCatalog.length,
    };
  }, [fullCatalog, filteredCatalog.length, skills, refCounts]);

  return {
    isLoading: skillsLoading || refCountsLoading,
    coverageRows,
    categoryCatalog: filteredCatalog,
    refCounts,
    stats,
    filteredCatalogLength: filteredCatalog.length,
  };
}