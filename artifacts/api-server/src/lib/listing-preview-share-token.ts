import crypto from "node:crypto";
import { requireSigningSecret } from "./require-production-secret.js";

const PURPOSE = "listing-preview-v1";

type ListingPreviewSharePayload = {
  auditId: number;
  purpose: typeof PURPOSE;
};

function signingSecret(): string {
  return requireSigningSecret(
    ["LISTING_PREVIEW_SHARE_SECRET", "PUBLISH_IMAGE_SECRET", "CLERK_SECRET_KEY"],
    "dev-listing-preview-share-secret",
    "Listing preview share signing secret",
  );
}

export function createListingPreviewShareToken(auditId: number): string {
  const payload: ListingPreviewSharePayload = {
    auditId,
    purpose: PURPOSE,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyListingPreviewShareToken(auditId: number, token: string): boolean {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;

  const expected = crypto
    .createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  if (signature !== expected) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ListingPreviewSharePayload;
    return payload.purpose === PURPOSE && payload.auditId === auditId;
  } catch {
    return false;
  }
}
