import { getGetAuditQueryKey } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";
import { buildProductExplorerDraftFromGraphicsProject } from "@/lib/graphics-audit-draft";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type GraphicsRecordForSync = {
  id?: string;
  type?: string;
  imageType?: string;
  index?: number;
  currentUrl?: string;
  style?: string;
  aspectRatio?: string;
  versions?: unknown[];
};

type AuditImageRecordType = "main" | "infographic" | "lifestyle";

function mapGraphicsTypeToAudit(type: string | undefined): AuditImageRecordType {
  if (type === "feature" || type === "infographic") return "infographic";
  if (type === "main") return "main";
  return "lifestyle";
}

export function mapGraphicsRecordsToAuditPayload(records: GraphicsRecordForSync[]) {
  const withUrls = records.filter((r) => r.currentUrl?.trim());
  const imageRecords = withUrls.map((r, i) => ({
    id: r.id ?? `${r.type ?? "lifestyle"}_${r.index ?? i}`,
    type: mapGraphicsTypeToAudit(r.type),
    index: r.index ?? i,
    style: r.style ?? "modern",
    aspectRatio: r.aspectRatio ?? "1:1",
    currentUrl: r.currentUrl!.trim(),
    versions: r.versions ?? [],
  }));

  const generatedImages = {
    main: withUrls.filter((r) => mapGraphicsTypeToAudit(r.type) === "main").map((r) => r.currentUrl!.trim()),
    lifestyle: withUrls.filter((r) => mapGraphicsTypeToAudit(r.type) === "lifestyle").map((r) => r.currentUrl!.trim()),
    infographic: withUrls
      .filter((r) => mapGraphicsTypeToAudit(r.type) === "infographic")
      .map((r) => r.currentUrl!.trim()),
  };

  const graphicUrls = withUrls.map((r) => r.currentUrl!.trim());

  return { imageRecords, generatedImages, graphicUrls };
}

export async function saveGraphicsRecordsToProductExplorer(
  auditId: number,
  records: GraphicsRecordForSync[],
  queryClient?: QueryClient,
): Promise<void> {
  if (records.length === 0) {
    throw new Error("Generate at least one graphic before saving.");
  }

  const auditRes = await fetch(`${basePath}/api/audits/${auditId}`, { credentials: "include" });
  if (!auditRes.ok) {
    throw new Error("Could not load the linked product.");
  }
  const audit = (await auditRes.json()) as {
    currentStep?: number | null;
    imageUrls?: string[] | null;
  };

  const { imageRecords, generatedImages, graphicUrls } = mapGraphicsRecordsToAuditPayload(records);

  const mergedUrls: string[] = [];
  const addUrl = (url: string | undefined | null) => {
    const trimmed = url?.trim();
    if (trimmed && !mergedUrls.includes(trimmed)) mergedUrls.push(trimmed);
  };
  for (const url of audit.imageUrls ?? []) addUrl(url);
  for (const url of graphicUrls) addUrl(url);

  const currentStep = Math.max(audit.currentStep ?? 1, 3);

  const patchRes = await fetch(`${basePath}/api/audits/${auditId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      imageRecords,
      generatedImages,
      imageUrls: mergedUrls,
      currentStep,
    }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not save to Product Explorer.");
  }

  void queryClient?.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
  void queryClient?.invalidateQueries({ queryKey: ["graphics-project-for-audit", auditId] });
  void queryClient?.invalidateQueries({ queryKey: ["products"] });
  void queryClient?.invalidateQueries({ queryKey: ["product", auditId] });
}

export type ScratchGraphicsProject = {
  id: number;
  name: string;
  productName: string;
  category: string | null;
  sourceImageUrls?: string[] | null;
  auditId?: number | null;
};

async function linkGraphicsProjectToAudit(projectId: number, auditId: number): Promise<void> {
  const res = await fetch(`${basePath}/api/graphics/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ auditId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not link graphics to product.");
  }
}

export async function ensureAuditForScratchGraphicsProject(
  project: ScratchGraphicsProject,
): Promise<number> {
  if (project.auditId != null && project.auditId > 0) {
    return project.auditId;
  }

  const draftBody = buildProductExplorerDraftFromGraphicsProject(project);
  if (!draftBody) {
    throw new Error("Product name is required to save to Product Explorer.");
  }

  const draftRes = await fetch(`${basePath}/api/audits/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(draftBody),
  });
  if (!draftRes.ok) {
    const err = await draftRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not create product.");
  }
  const audit = (await draftRes.json()) as { id: number };

  await linkGraphicsProjectToAudit(project.id, audit.id);
  return audit.id;
}

/** Scratch (or unlinked) graphics → create/link listing + sync images + return audit id for navigation. */
export async function saveScratchGraphicsProjectToProductExplorer(
  project: ScratchGraphicsProject,
  records: GraphicsRecordForSync[],
  queryClient?: QueryClient,
): Promise<number> {
  const auditId = await ensureAuditForScratchGraphicsProject(project);
  await saveGraphicsRecordsToProductExplorer(auditId, records, queryClient);
  void queryClient?.invalidateQueries({ queryKey: ["graphics-project", String(project.id)] });
  return auditId;
}
