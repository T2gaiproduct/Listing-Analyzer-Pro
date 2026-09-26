/**
 * Cloud Agent quick tunnel (*.trycloudflare.com). Opt-in via VITE_CLOUD_AGENT_PREVIEW=true
 * (dev-stack only). Default off so staging/main deploys never enable preview-only auth/onboarding hacks.
 */
export function isCloudflareQuickPreviewHost(): boolean {
  if (import.meta.env.VITE_CLOUD_AGENT_PREVIEW !== "true") return false;
  return typeof window !== "undefined" && window.location.hostname.endsWith(".trycloudflare.com");
}
