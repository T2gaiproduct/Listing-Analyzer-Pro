import crypto from "node:crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

type PublishImageTokenPayload = {
  auditId: number;
  filename: string;
  graphicsProjectId: number | null;
  exp: number;
};

function signingSecret(): string {
  return process.env.CLERK_SECRET_KEY?.trim()
    || process.env.PUBLISH_IMAGE_SECRET?.trim()
    || "dev-publish-image-secret";
}

export function createPublishImageToken(input: {
  auditId: number;
  filename: string;
  graphicsProjectId?: number | null;
}): string {
  const payload: PublishImageTokenPayload = {
    auditId: input.auditId,
    filename: input.filename,
    graphicsProjectId: input.graphicsProjectId ?? null,
    exp: Date.now() + TOKEN_TTL_MS,
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
  });
  return `${base}/api/marketplace-publish/images/${auditId}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
}
