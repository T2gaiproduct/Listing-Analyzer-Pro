import { resolveAppImageUrl } from "@/lib/protected-app-image";

/** Download an app-hosted or absolute image URL as a file (works for /api/images/... paths). */
export async function downloadAppImage(url: string, filename: string): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error("No image URL");
  }

  const fullUrl = resolveAppImageUrl(trimmed);
  const response = await fetch(fullUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
