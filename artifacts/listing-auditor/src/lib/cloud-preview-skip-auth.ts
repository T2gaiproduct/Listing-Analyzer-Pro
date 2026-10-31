/** Set at build time by dev-stack quick tunnel (never on sellerlens.io deploys). */
export function isCloudPreviewSkipAuthBuild(): boolean {
  return import.meta.env.VITE_CLOUD_PREVIEW_SKIP_AUTH === "true";
}
