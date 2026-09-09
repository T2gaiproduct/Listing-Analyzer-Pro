import { pickProjectThumbnail } from "./scoped-recents-load.js";

const GENERIC_PROJECT_NAMES = new Set(["product", "untitled project", "untitled", "new project"]);

function isWeakProjectLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_PROJECT_NAMES.has(normalized)) return true;
  // Single short tokens like "light", "test", "demo" are not useful alone in lists.
  if (normalized.length <= 5 && !normalized.includes(" ")) return true;
  return false;
}

/** Human-friendly label for dashboard / recents lists. */
export function displayProjectName(
  name: string | null | undefined,
  productName?: string | null,
  category?: string | null,
): string {
  const trimmedName = name?.trim() ?? "";
  const trimmedProduct = productName?.trim() ?? "";
  const trimmedCategory = category?.trim() ?? "";

  if (trimmedName && !isWeakProjectLabel(trimmedName) && !GENERIC_PROJECT_NAMES.has(trimmedName.toLowerCase())) {
    return trimmedName;
  }

  const parts: string[] = [];
  if (trimmedProduct && !isWeakProjectLabel(trimmedProduct)) {
    parts.push(trimmedProduct);
  }
  if (trimmedCategory) {
    parts.push(trimmedCategory);
  }
  if (parts.length > 0) return parts.join(" — ");

  return trimmedName || trimmedProduct || trimmedCategory || "Untitled Project";
}

export function resolveGraphicsProjectUrl(input: {
  id: number;
  auditId?: number | null;
  status: string;
}): string {
  if (input.auditId != null) {
    return `/audits/workflow?resume=${input.auditId}`;
  }
  if (input.status === "generating") {
    return `/projects/${input.id}/generating`;
  }
  return `/projects/${input.id}`;
}

export function resolveGraphicsThumbnailUrl(
  projectId: number,
  sourceImageUrls: string[] | null | undefined,
  imageRecords: Array<{ currentUrl?: string }> | null | undefined,
): string | null {
  const picked = pickProjectThumbnail({ sourceImageUrls, imageRecords });
  if (picked?.startsWith("/api/images/")) return picked;

  for (const raw of sourceImageUrls ?? []) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("/api/images/graphics/")) return trimmed;
    const filename = trimmed.split("/").pop();
    if (filename) {
      return `/api/images/graphics/${projectId}/${encodeURIComponent(filename)}`;
    }
  }

  if (picked) {
    const filename = picked.split("/").pop();
    if (filename) {
      return `/api/images/graphics/${projectId}/${encodeURIComponent(filename)}`;
    }
  }

  return null;
}

export function disambiguateRecentProjectNames<
  T extends { type: string; id: number; name: string },
>(projects: T[]): T[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const key = `${project.type}:${project.name.toLowerCase()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return projects.map((project) => {
    const key = `${project.type}:${project.name.toLowerCase()}`;
    if ((counts.get(key) ?? 0) <= 1) return project;
    return { ...project, name: `${project.name} #${project.id}` };
  });
}
