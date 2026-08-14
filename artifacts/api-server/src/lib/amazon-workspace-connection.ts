import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, settingsTable } from "@workspace/db";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";

/** Per-workspace seller authorization from Amazon OAuth (no app credentials). */
export type AmazonWorkspaceSellerConnection = {
  sellerId?: string;
  refreshToken?: string;
  marketplaceIds: string[];
  sellerConnectedAt?: string;
  defaultMarketplace?: string;
};

/** @deprecated Legacy shape that stored per-workspace SP-API app credentials. */
export type AmazonWorkspaceConnectionWithSecret = AmazonWorkspaceSellerConnection & {
  applicationId?: string;
  clientId?: string;
  clientSecret?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRoleArn?: string;
  sandbox?: boolean;
  redirectUri?: string;
  connectedAt?: string;
};

function amazonConnectionKey(workspaceId: number): string {
  return `marketplace_connection_${workspaceId}_amazon`;
}

function parseAmazonWorkspaceSellerConnection(
  raw: string | null | undefined,
): AmazonWorkspaceSellerConnection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AmazonWorkspaceSellerConnection & AmazonWorkspaceConnectionWithSecret;
    const sellerId = parsed.sellerId?.trim() || undefined;
    const refreshToken = parsed.refreshToken?.trim() || undefined;
    if (!sellerId && !refreshToken) return null;
    return {
      sellerId,
      refreshToken,
      marketplaceIds: Array.isArray(parsed.marketplaceIds) ? parsed.marketplaceIds : [],
      sellerConnectedAt: parsed.sellerConnectedAt,
      defaultMarketplace: parsed.defaultMarketplace?.trim().toUpperCase() || undefined,
    };
  } catch {
    return null;
  }
}

export function isAmazonWorkspaceSellerConnected(
  connection: AmazonWorkspaceSellerConnection | null,
): boolean {
  return Boolean(connection?.sellerId && connection.refreshToken);
}

export function buildAmazonOAuthRedirectUri(req: Request): string {
  const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
  return `${base}/api/amazon/oauth/callback`;
}

export async function getAmazonWorkspaceSellerConnection(
  workspaceId: number,
): Promise<AmazonWorkspaceSellerConnection | null> {
  const key = amazonConnectionKey(workspaceId);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return parseAmazonWorkspaceSellerConnection(row?.value);
}

/** @deprecated Use getAmazonWorkspaceSellerConnection */
export async function getAmazonWorkspaceConnection(
  workspaceId: number,
): Promise<AmazonWorkspaceConnectionWithSecret | null> {
  return getAmazonWorkspaceSellerConnection(workspaceId);
}

async function upsertAmazonWorkspaceSellerConnection(
  workspaceId: number,
  connection: AmazonWorkspaceSellerConnection,
): Promise<AmazonWorkspaceSellerConnection> {
  const key = amazonConnectionKey(workspaceId);
  const payload = JSON.stringify(connection);
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

  return connection;
}

export async function saveAmazonWorkspaceSellerConnection(
  workspaceId: number,
  input: { sellerId: string; refreshToken: string; marketplaceIds?: string[] },
): Promise<AmazonWorkspaceSellerConnection> {
  const existing = await getAmazonWorkspaceSellerConnection(workspaceId);
  const connection: AmazonWorkspaceSellerConnection = {
    sellerId: input.sellerId.trim(),
    refreshToken: input.refreshToken.trim(),
    marketplaceIds: input.marketplaceIds ?? existing?.marketplaceIds ?? [],
    sellerConnectedAt: new Date().toISOString(),
    defaultMarketplace: existing?.defaultMarketplace,
  };

  return upsertAmazonWorkspaceSellerConnection(workspaceId, connection);
}

export async function disconnectAmazonWorkspaceSellerConnection(workspaceId: number): Promise<void> {
  const key = amazonConnectionKey(workspaceId);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}

/** @deprecated Alias for disconnectAmazonWorkspaceSellerConnection */
export async function disconnectAmazonWorkspaceConnection(workspaceId: number): Promise<void> {
  await disconnectAmazonWorkspaceSellerConnection(workspaceId);
}
