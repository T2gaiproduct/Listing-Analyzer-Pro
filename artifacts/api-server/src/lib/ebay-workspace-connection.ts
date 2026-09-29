import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";

export type EbayWorkspaceSellerConnection = {
  refreshToken: string;
  environment: EbayOAuthEnvironment;
  ebayUserId?: string;
  username?: string;
  connectedAt: string;
};

function ebayConnectionKey(workspaceId: number): string {
  return `marketplace_connection_${workspaceId}_ebay`;
}

function parseEbayConnection(raw: string | null | undefined): EbayWorkspaceSellerConnection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EbayWorkspaceSellerConnection;
    const refreshToken = parsed.refreshToken?.trim();
    if (!refreshToken) return null;
    const environment = parsed.environment === "production" ? "production" : "sandbox";
    return {
      refreshToken,
      environment,
      ebayUserId: parsed.ebayUserId?.trim() || undefined,
      username: parsed.username?.trim() || undefined,
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export type EbayWorkspaceConnectionPublic = {
  connected: boolean;
  environment: EbayOAuthEnvironment | null;
  username: string | null;
  ebayUserId: string | null;
  connectedAt: string | null;
};

export async function getEbayWorkspaceConnection(
  workspaceId: number,
): Promise<EbayWorkspaceSellerConnection | null> {
  const key = ebayConnectionKey(workspaceId);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return parseEbayConnection(row?.value);
}

export async function getEbayWorkspaceConnectionPublic(
  workspaceId: number,
): Promise<EbayWorkspaceConnectionPublic> {
  const connection = await getEbayWorkspaceConnection(workspaceId);
  return {
    connected: Boolean(connection),
    environment: connection?.environment ?? null,
    username: connection?.username ?? null,
    ebayUserId: connection?.ebayUserId ?? null,
    connectedAt: connection?.connectedAt ?? null,
  };
}

export async function saveEbayWorkspaceSellerConnection(
  workspaceId: number,
  input: {
    refreshToken: string;
    environment: EbayOAuthEnvironment;
    ebayUserId?: string;
    username?: string;
  },
): Promise<EbayWorkspaceSellerConnection> {
  const record: EbayWorkspaceSellerConnection = {
    refreshToken: input.refreshToken.trim(),
    environment: input.environment,
    ebayUserId: input.ebayUserId?.trim() || undefined,
    username: input.username?.trim() || undefined,
    connectedAt: new Date().toISOString(),
  };
  const key = ebayConnectionKey(workspaceId);
  const payload = JSON.stringify(record);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);

  if (row) {
    await db
      .update(settingsTable)
      .set({ value: payload, updatedAt: new Date(), isSecret: true })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({
      key,
      value: payload,
      category: "marketplace_connections",
      isSecret: true,
    });
  }
  return record;
}

export async function disconnectEbayWorkspaceConnection(workspaceId: number): Promise<void> {
  const key = ebayConnectionKey(workspaceId);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}
