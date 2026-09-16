const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Browsers reject wss to a raw IP when the cert is issued for a domain (ERR_CERT_COMMON_NAME_INVALID). */
export function isIpHostname(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.includes(":") && !hostname.includes(".")) return true;
  return false;
}

/** WebSocket URL for notification stream, or null when a connection would reliably fail (e.g. HTTPS + IP). */
export function buildNotificationWebSocketUrl(): string | null {
  const { protocol, host, hostname } = window.location;
  if (protocol === "https:" && isIpHostname(hostname)) {
    return null;
  }
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}${basePath}/api/ws`;
}
