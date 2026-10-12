import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  parseWalmartEnvironment,
  type WalmartEnvironment,
  type WalmartTokenConnection,
} from "./walmart-oauth.js";

export type WalmartWorkspaceConnection = WalmartTokenConnection & {
  connectedAt: string;
  authMode?: "oauth" | "legacy";
};

export type WalmartWorkspaceConnectionPublic = {
  connected: boolean;
  connectReady: boolean;
  partnerId: string | null;
  clientId: string | null;
  environment: WalmartEnvironment | null;
  connectedAt: string | null;
  authMode: "oauth" | "legacy" | null;
};

function walmartConnectionKey(workspaceId: number): string {
  return `marketplace_connection_${workspaceId}_walmart`;
}

function parseWalmartConnection(raw: string | null | undefined): WalmartWorkspaceConnection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WalmartWorkspaceConnection;
    const partnerId = parsed.partnerId?.trim();
    const refreshToken = parsed.refreshToken?.trim();
    if (!partnerId || !refreshToken) return null;

    const clientId = parsed.clientId?.trim();
    const clientSecret = parsed.clientSecret?.trim();
    const authMode = parsed.authMode
      ?? (clientId && clientSecret ? "legacy" : "oauth");

    if (authMode === "legacy" && (!clientId || !clientSecret)) return null;

    return {
      partnerId,
      refreshToken,
      environment: parseWalmartEnvironment(parsed.environment),
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
      authMode,
      ...(clientId ? { clientId } : {}),
      ...(clientSecret ? { clientSecret } : {}),
    };
  } catch {
    return null;
  }
}

export async function getWalmartWorkspaceConnection(
  workspaceId: number,
): Promise<WalmartWorkspaceConnection | null> {
  const key = walmartConnectionKey(workspaceId);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return parseWalmartConnection(row?.value);
}

export async function getWalmartWorkspaceConnectionPublic(
  workspaceId: number,
  connectReady: boolean,
): Promise<WalmartWorkspaceConnectionPublic> {
  const connection = await getWalmartWorkspaceConnection(workspaceId);
  return {
    connected: Boolean(connection),
    connectReady,
    partnerId: connection?.partnerId ?? null,
    clientId: connection?.clientId ?? null,
    environment: connection?.environment ?? null,
    connectedAt: connection?.connectedAt ?? null,
    authMode: connection?.authMode ?? null,
  };
}

async function persistWalmartWorkspaceConnection(
  workspaceId: number,
  record: WalmartWorkspaceConnection,
): Promise<WalmartWorkspaceConnection> {
  const key = walmartConnectionKey(workspaceId);
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

/** @deprecated Legacy manual credential connect — prefer OAuth save. */
export async function saveWalmartWorkspaceConnection(
  workspaceId: number,
  input: {
    partnerId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    environment: WalmartEnvironment;
  },
): Promise<WalmartWorkspaceConnection> {
  const record: WalmartWorkspaceConnection = {
    partnerId: input.partnerId.trim(),
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    refreshToken: input.refreshToken.trim(),
    environment: input.environment,
    connectedAt: new Date().toISOString(),
    authMode: "legacy",
  };
  return persistWalmartWorkspaceConnection(workspaceId, record);
}

export async function saveWalmartWorkspaceOAuthConnection(
  workspaceId: number,
  input: {
    sellerId: string;
    refreshToken: string;
    environment: WalmartEnvironment;
  },
): Promise<WalmartWorkspaceConnection> {
  const record: WalmartWorkspaceConnection = {
    partnerId: input.sellerId.trim(),
    refreshToken: input.refreshToken.trim(),
    environment: input.environment,
    connectedAt: new Date().toISOString(),
    authMode: "oauth",
  };
  return persistWalmartWorkspaceConnection(workspaceId, record);
}

export async function disconnectWalmartWorkspaceConnection(workspaceId: number): Promise<void> {
  const key = walmartConnectionKey(workspaceId);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}
