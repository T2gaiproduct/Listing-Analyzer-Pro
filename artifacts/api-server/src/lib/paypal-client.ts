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

export async function getPayPalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const s = await getGatewaySettings();
  const clientId = s.paypal_client_id ?? "";
  const secret = s.paypal_client_secret ?? "";
  const mode = s.paypal_mode ?? "sandbox";
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const r = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json() as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(`PayPal auth failed: ${d.error ?? "unknown"}`);
  return { token: d.access_token, baseUrl };
}
