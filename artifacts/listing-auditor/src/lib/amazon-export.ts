const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ExportValidationLevel = "error" | "warning" | "info";

export interface ExportValidationItem {
  level: ExportValidationLevel;
  field: string;
  message: string;
}

export interface AmazonExportValidation {
  ready: boolean;
  validation: ExportValidationItem[];
  summary: {
    sku: string;
    imageCount: number;
    hasAsin: boolean;
    aplusModuleCount: number;
  };
}

export interface AmazonConnection {
  connected: boolean;
  sellerId: string | null;
  marketplaceId: string;
  spApiConfigured: boolean;
}

export interface AmazonPublishResult {
  success: boolean;
  status: "submitted" | "simulated" | "failed" | "not_configured";
  message: string;
  submissionId?: string;
  validation?: ExportValidationItem[];
  warnings?: ExportValidationItem[];
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function filenameFromDisposition(res: Response, fallback: string): string {
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function fetchAmazonExportValidation(auditId: number): Promise<AmazonExportValidation> {
  const res = await fetch(`${basePath}/api/audits/${auditId}/export/validate`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json() as Promise<AmazonExportValidation>;
}

export async function fetchAmazonConnection(): Promise<AmazonConnection> {
  const res = await fetch(`${basePath}/api/amazon/connection`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json() as Promise<AmazonConnection>;
}

export async function downloadAmazonExcelExport(auditId: number): Promise<void> {
  const res = await fetch(`${basePath}/api/audits/${auditId}/export/excel`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseApiError(res));
  const blob = await res.blob();
  const filename = filenameFromDisposition(res, `audit_${auditId}_listing.tsv`);
  triggerBlobDownload(blob, filename);
}

export async function downloadAmazonZipExport(auditId: number): Promise<void> {
  const res = await fetch(`${basePath}/api/audits/${auditId}/export/zip`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseApiError(res));
  const blob = await res.blob();
  const filename = filenameFromDisposition(res, `audit_${auditId}_listing.zip`);
  triggerBlobDownload(blob, filename);
}

export async function publishAuditToAmazon(
  auditId: number,
  mode: "update" | "create" = "update",
): Promise<AmazonPublishResult> {
  const res = await fetch(`${basePath}/api/audits/${auditId}/publish-amazon`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const body = (await res.json()) as AmazonPublishResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? `Publish failed (${res.status})`);
  }
  return body;
}
