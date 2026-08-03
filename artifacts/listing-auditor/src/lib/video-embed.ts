/** Trim and ensure a scheme for pasted URLs (admin often pastes without https). */
export function normalizeVideoUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/** Extract a YouTube video id from common URL formats. */
export function youtubeVideoId(url: string): string | null {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1]) return parts[1];
      if (parts[0] === "shorts" && parts[1]) return parts[1];
      if (parts[0] === "live" && parts[1]) return parts[1];
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) return id.split("?")[0];
    }
  } catch {
    return null;
  }

  return null;
}

type YoutubeEmbedOptions = {
  autoplay?: boolean;
  mute?: boolean;
  loop?: boolean;
  controls?: boolean;
  origin?: string;
};

/** Convert common YouTube watch/share URLs to an embeddable iframe src. */
export function youtubeEmbedUrl(url: string, opts?: YoutubeEmbedOptions): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  if (opts?.autoplay) params.set("autoplay", "1");
  if (opts?.mute) params.set("mute", "1");
  if (opts?.loop) {
    params.set("loop", "1");
    params.set("playlist", id);
  }
  if (opts?.controls === false) {
    params.set("controls", "0");
    params.set("disablekb", "1");
    params.set("fs", "0");
    params.set("iv_load_policy", "3");
  }
  const origin = opts?.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (origin) params.set("origin", origin);

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/** Muted looping preview for card thumbnails (browser autoplay policy friendly). */
export function youtubePreviewEmbedUrl(url: string): string | null {
  return youtubeEmbedUrl(url, {
    autoplay: true,
    mute: true,
    loop: true,
    controls: false,
  });
}

/** YouTube poster image for a watch/share URL. */
export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
