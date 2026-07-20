/** Extract a YouTube video id from common URL formats. */
export function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1]) return parts[1];
      if (parts[0] === "shorts" && parts[1]) return parts[1];
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) return id;
    }
  } catch {
    return null;
  }

  return null;
}

/** Convert common YouTube watch/share URLs to an embeddable iframe src. */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** YouTube poster image for a watch/share URL. */
export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
