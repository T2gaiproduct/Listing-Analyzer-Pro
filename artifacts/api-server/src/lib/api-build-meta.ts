import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface BuildMetaFile {
  buildId: string;
  builtAt: string;
}

export function readDiskBuildMeta(): BuildMetaFile | null {
  try {
    const metaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "build-meta.json");
    if (!existsSync(metaPath)) return null;
    const raw = readFileSync(metaPath, "utf8");
    const parsed = JSON.parse(raw) as BuildMetaFile;
    if (typeof parsed.buildId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build id loaded when this process started (from dist/build-meta.json). */
export const loadedBuildId: string = readDiskBuildMeta()?.buildId ?? "unknown";

export function isStaleApiProcess(): boolean {
  const disk = readDiskBuildMeta();
  if (!disk) return false;
  return disk.buildId !== loadedBuildId;
}
