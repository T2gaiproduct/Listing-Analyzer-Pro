/**
 * Cloud Agent quick tunnel (*.trycloudflare.com). Hostname is the guard — production uses
 * sellerlens.io, not trycloudflare.com. VITE_CLOUD_AGENT_PREVIEW remains an extra opt-in for
 * non-standard preview hosts.
 */
export function isCloudflareQuickPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hostname.endsWith(".trycloudflare.com")) return true;
  return import.meta.env.VITE_CLOUD_AGENT_PREVIEW === "true";
}
