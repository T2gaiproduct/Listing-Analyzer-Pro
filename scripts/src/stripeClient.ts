import Stripe from "stripe";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
      "Ensure REPLIT_CONNECTORS_HOSTNAME and REPL_IDENTITY are set.\n" +
      "Run this script via `pnpm --filter @workspace/scripts run seed-stripe` from the project root.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { items?: Array<{ settings?: { secret_key?: string } }> };
  const secretKey = data.items?.[0]?.settings?.secret_key;

  if (!secretKey) {
    throw new Error(
      "Stripe not connected. Connect Stripe via the Integrations tab first.",
    );
  }

  return new Stripe(secretKey);
}
