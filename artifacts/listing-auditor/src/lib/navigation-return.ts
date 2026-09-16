/** Safe in-app return path from ?returnTo= (must be same-origin relative path). */
export function getSafeReturnTo(search: string, fallback = "/dashboard"): string {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("returnTo")?.trim();
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

/** Append or replace returnTo on a project/deep link href. */
export function appendReturnTo(href: string, returnTo: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("returnTo", returnTo);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
