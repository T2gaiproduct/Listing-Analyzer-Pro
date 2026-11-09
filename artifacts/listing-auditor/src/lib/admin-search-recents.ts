export type AdminSearchRecent = {
  name: string;
  url: string;
};

const STORAGE_KEY = "eg-admin-search-recents";
const MAX_RECENTS = 10;

export function loadAdminSearchRecents(): AdminSearchRecent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is AdminSearchRecent =>
          typeof entry === "object"
          && entry != null
          && typeof (entry as AdminSearchRecent).name === "string"
          && typeof (entry as AdminSearchRecent).url === "string",
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function pushAdminSearchRecent(item: AdminSearchRecent): void {
  if (typeof window === "undefined") return;
  const trimmedName = item.name.trim();
  const trimmedUrl = item.url.trim();
  if (!trimmedName || !trimmedUrl || !trimmedUrl.startsWith("/")) return;

  const prev = loadAdminSearchRecents().filter((r) => r.url !== trimmedUrl);
  const next = [{ name: trimmedName, url: trimmedUrl }, ...prev].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
