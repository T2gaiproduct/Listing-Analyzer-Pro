import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export async function getGatewaySettings(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.category, "payment_gateway"));
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

function normalizePayPalMode(mode: string | undefined): "live" | "sandbox" {
  return mode?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export async function requestPayPalAccessToken(params: {
  clientId: string;
  clientSecret: string;
  mode?: string;
}): Promise<{ token: string; baseUrl: string; mode: "live" | "sandbox" }> {
  const clientId = params.clientId.trim();
  const clientSecret = params.clientSecret.trim();
  const mode = normalizePayPalMode(params.mode);
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const r = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json() as { access_token?: string; error?: string };
  if (!d.access_token) {
    const modeLabel = mode === "live" ? "Live" : "Sandbox";
    const hint =
      d.error === "invalid_client"
        ? `Use ${modeLabel} Client ID and Secret from the same PayPal app, save settings, then test again.`
        : mode === "live"
          ? "Check that Live credentials are used with Live mode."
          : "Check that Sandbox credentials are used with Sandbox mode.";
    throw new Error(`PayPal auth failed: ${d.error ?? "unknown"}. ${hint}`);
  }
  return { token: d.access_token, baseUrl, mode };
}

export async function getPayPalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const s = await getGatewaySettings();
  const { token, baseUrl } = await requestPayPalAccessToken({
    clientId: s.paypal_client_id ?? "",
    clientSecret: s.paypal_client_secret ?? "",
    mode: s.paypal_mode,
  });
  return { token, baseUrl };
}
