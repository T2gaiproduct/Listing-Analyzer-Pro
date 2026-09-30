/**
 * Cloud Agent quick tunnel (*.trycloudflare.com).
 * Hostname-only check: production/staging on real domains never use trycloudflare.com.
 * VITE_CLOUD_AGENT_PREVIEW is still set by dev-stack for clarity in local builds.
 */
export function isCloudflareQuickPreviewHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".trycloudflare.com");
}
