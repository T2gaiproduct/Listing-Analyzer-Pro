import fs from "node:fs";
import path from "node:path";
import { IMAGES_DIR } from "./image-storage";

export const BRANDING_DIR = path.join(IMAGES_DIR, "branding");

const ASSET_BASENAMES = {
  site_logo_url: "site-logo",
  site_favicon_url: "site-favicon",
} as const;

export type BrandingAssetKey = keyof typeof ASSET_BASENAMES;

export function ensureBrandingDir(): void {
  if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

export function isDataUrl(value: string): boolean {
  return value.trim().startsWith("data:");
}

function extFromMime(mime: string): string {
  if (mime === "svg+xml") return "svg";
  if (mime === "x-icon" || mime === "vnd.microsoft.icon") return "ico";
  if (mime === "jpeg") return "jpg";
  return mime.split("+")[0] ?? "png";
}

export function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } | null {
  const match = dataUrl.trim().match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return {
    ext: extFromMime(match[1]),
    buffer: Buffer.from(match[2], "base64"),
  };
}

export function brandingPublicPath(key: BrandingAssetKey, ext: string): string {
  return `/api/images/branding/${ASSET_BASENAMES[key]}.${ext}`;
}

export function clearBrandingAsset(key: BrandingAssetKey): void {
  if (!fs.existsSync(BRANDING_DIR)) return;
  const prefix = `${ASSET_BASENAMES[key]}.`;
  for (const file of fs.readdirSync(BRANDING_DIR)) {
    if (file.startsWith(prefix)) {
      fs.unlinkSync(path.join(BRANDING_DIR, file));
    }
  }
}

/** Persist a data URL or pass through an existing public path. Returns stored path or "". */
export function persistBrandingAsset(key: BrandingAssetKey, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    clearBrandingAsset(key);
    return "";
  }
  if (!isDataUrl(trimmed)) return trimmed;

  const parsed = parseDataUrl(trimmed);
  if (!parsed) throw new Error(`Invalid branding image for ${key}`);

  ensureBrandingDir();
  clearBrandingAsset(key);
  const filename = `${ASSET_BASENAMES[key]}.${parsed.ext}`;
  fs.writeFileSync(path.join(BRANDING_DIR, filename), parsed.buffer);
  return brandingPublicPath(key, parsed.ext);
}

export function normalizeBrandingSettingValue(key: BrandingAssetKey, value: string | undefined | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (isDataUrl(trimmed)) return persistBrandingAsset(key, trimmed);
  return trimmed;
}
