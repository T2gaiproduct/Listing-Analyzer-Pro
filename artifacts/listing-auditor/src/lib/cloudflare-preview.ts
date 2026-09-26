/** Cloud Agent quick tunnel hostname (*.trycloudflare.com) — not production. */
export function isCloudflareQuickPreviewHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".trycloudflare.com");
}
