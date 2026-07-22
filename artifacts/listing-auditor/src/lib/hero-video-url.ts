export type HeroVideoSource =
  | { kind: "file"; url: string }
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string };

function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const embed = parsed.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed?.[1]) return embed[1];
      const shorts = parsed.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "vimeo.com") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return /^\d+$/.test(id) ? id : null;
    }
    if (host === "player.vimeo.com") {
      const match = parsed.pathname.match(/^\/video\/(\d+)/);
      return match?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseHeroVideoSource(url: string): HeroVideoSource | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const yt = youtubeId(trimmed);
  if (yt) {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: yt,
      controls: "0",
      rel: "0",
      playsinline: "1",
      modestbranding: "1",
    });
    return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${yt}?${params}` };
  }

  const vimeo = vimeoId(trimmed);
  if (vimeo) {
    const params = new URLSearchParams({
      autoplay: "1",
      muted: "1",
      loop: "1",
      background: "1",
      playsinline: "1",
    });
    return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo}?${params}` };
  }

  return { kind: "file", url: trimmed };
}

export function isDirectVideoFileUrl(url: string): boolean {
  const source = parseHeroVideoSource(url);
  return source?.kind === "file";
}
