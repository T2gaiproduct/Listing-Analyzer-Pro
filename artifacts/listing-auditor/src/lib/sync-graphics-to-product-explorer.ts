import { getGetAuditQueryKey } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";

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
