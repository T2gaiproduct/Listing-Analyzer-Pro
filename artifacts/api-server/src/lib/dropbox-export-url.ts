/** Prefer direct image fetch for Excel / Amazon image columns. */
export function toDirectDropboxImageUrl(shareUrl: string): string {
  const trimmed = shareUrl.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "www.dropbox.com") {
      u.hostname = "dl.dropboxusercontent.com";
      u.searchParams.delete("dl");
      if (!u.searchParams.has("raw")) u.searchParams.set("raw", "1");
      return u.toString();
    }
    if (u.hostname.endsWith("dropboxusercontent.com") && !u.searchParams.has("raw")) {
      u.searchParams.set("raw", "1");
      return u.toString();
    }
    return trimmed;
  } catch {
    return trimmed
      .replace(/^https?:\/\/www\.dropbox\.com/i, "https://dl.dropboxusercontent.com")
      .replace(/\?dl=0\b/i, "?raw=1");
  }
}
