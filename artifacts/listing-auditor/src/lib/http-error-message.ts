/** User-facing message from a failed /api fetch (JSON, HTML, or empty body). */
export async function readApiErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  if (res.status === 413) {
    return "The image or request is too large for the server. Use a smaller file (under 4 MB per image), compress it, or upload fewer reference images.";
  }
  if (res.status === 401) {
    return "Your session expired. Sign in again and retry.";
  }
  if (res.status === 502 || res.status === 503) {
    return "The server is temporarily unavailable. Wait a moment and try again.";
  }

  const text = await res.text();
  if (!text.trim()) {
    return res.status >= 400 ? `${fallback} (HTTP ${res.status})` : fallback;
  }

  if (text.trimStart().startsWith("<")) {
    if (res.status === 413) {
      return "The image or request is too large. Use a smaller file (under 4 MB per image) or compress it before uploading.";
    }
    return `${fallback} (HTTP ${res.status})`;
  }

  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    const msg = data.error?.trim() || data.message?.trim();
    if (msg) return msg;
  } catch {
    /* not JSON */
  }

  return res.status >= 400 ? `${fallback} (HTTP ${res.status})` : fallback;
}

/** ~4 MB per file keeps JSON payloads under typical nginx limits with base64 overhead. */
export const GRAPHICS_MAX_SOURCE_FILE_BYTES = 4 * 1024 * 1024;

export function formatGraphicsFileTooLarge(fileName: string): string {
  return `"${fileName}" is too large. Use an image under 4 MB (compress or resize it), then upload again.`;
}
