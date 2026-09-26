/**
 * Ephemeral Cloud Agent quick tunnels (*.trycloudflare.com).
 * Opt-in via ENABLE_CLOUD_AGENT_QUICK_TUNNEL=true (set only by scripts/dev-stack.sh).
 * Staging/production deploys must not set this — hostname checks stay inert.
 */
export function isCloudAgentQuickTunnelHostname(hostname: string): boolean {
  if (process.env.ENABLE_CLOUD_AGENT_QUICK_TUNNEL !== "true") return false;
  return hostname.endsWith(".trycloudflare.com");
}
