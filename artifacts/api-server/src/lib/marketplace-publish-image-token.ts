import crypto from "node:crypto";
import { requireSigningSecret } from "./require-production-secret.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
/** Amazon flat-file / Excel exports need URLs that stay valid after download. */
const EXPORT_LISTING_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type PublishImageTokenPayload = {
  auditId: number;
  filename: string;
  graphicsProjectId: number | null;
  exp: number;
};

function signingSecret(): string {
  return requireSigningSecret(
    ["PUBLISH_IMAGE_SECRET", "CLERK_SECRET_KEY"],
    "dev-publish-image-secret",
    "Publish image signing secret",
  );
}

export function createPublishImageToken(input: {
  auditId: number;
  filename: string;
  graphicsProjectId?: number | null;
  /** Longer TTL for CSV/Excel export image columns (not live marketplace publish). */
  exportListing?: boolean;
}): string {
  const ttl = input.exportListing ? EXPORT_LISTING_TOKEN_TTL_MS : TOKEN_TTL_MS;
  const payload: PublishImageTokenPayload = {
    auditId: input.auditId,
    filename: input.filename,
    graphicsProjectId: input.graphicsProjectId ?? null,
    exp: Date.now() + ttl,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyPublishImageToken(token: string): PublishImageTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PublishImageTokenPayload;
    if (!payload.auditId || !payload.filename || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    if (payload.filename.includes("..") || payload.filename.includes("/")) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSignedPublishImageUrl(input: {
  publicBaseUrl: string;
  auditId: number;
  sourceUrl: string;
  graphicsProjectId?: number | null;
  exportListing?: boolean;
}): string | null {
  const base = input.publicBaseUrl.trim().replace(/\/$/, "");
  if (!base) return null;

  const graphicsMatch = input.sourceUrl.match(/\/api\/images\/graphics\/(\d+)\/([^/?]+)/i);
  if (graphicsMatch) {
    const projectId = Number.parseInt(graphicsMatch[1]!, 10);
    const filename = decodeURIComponent(graphicsMatch[2]!);
    if (!Number.isFinite(projectId) || !filename) return null;
    const token = createPublishImageToken({
      auditId: input.auditId,
      filename,
      graphicsProjectId: projectId,
      exportListing: input.exportListing,
    });
    return `${base}/api/marketplace-publish/images/graphics/${projectId}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
  }

  const auditMatch = input.sourceUrl.match(/\/api\/images\/(\d+)\/([^/?]+)/i);
  const filename = auditMatch
    ? decodeURIComponent(auditMatch[2]!)
    : decodeURIComponent((input.sourceUrl.split("?")[0] ?? input.sourceUrl).split("/").pop() ?? "");
  const auditId = auditMatch ? Number.parseInt(auditMatch[1]!, 10) : input.auditId;
  if (!filename || !Number.isFinite(auditId)) return null;

  const token = createPublishImageToken({
    auditId,
    filename,
    graphicsProjectId: input.graphicsProjectId ?? null,
    exportListing: input.exportListing,
  });
  return `${base}/api/marketplace-publish/images/${auditId}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
}
