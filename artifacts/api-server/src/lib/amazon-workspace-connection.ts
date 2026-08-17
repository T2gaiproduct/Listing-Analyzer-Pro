import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, settingsTable } from "@workspace/db";
import type { AmazonSpSettings } from "./amazon-sp-settings.js";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";

/** Per-workspace seller authorization from Amazon OAuth. */
export type AmazonWorkspaceSellerConnection = {
  sellerId?: string;
  refreshToken?: string;
  marketplaceIds: string[];
  sellerConnectedAt?: string;
  defaultMarketplace?: string;
};

/** Legacy per-workspace blob that may also include SP-API app credentials. */
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

function parseRawAmazonWorkspaceRecord(
  raw: string | null | undefined,
): AmazonWorkspaceConnectionWithSecret | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AmazonWorkspaceConnectionWithSecret;
    return {
      applicationId: parsed.applicationId?.trim() || undefined,
      clientId: parsed.clientId?.trim() || undefined,
      clientSecret: parsed.clientSecret?.trim() || undefined,
      awsAccessKeyId: parsed.awsAccessKeyId?.trim() || undefined,
      awsSecretAccessKey: parsed.awsSecretAccessKey?.trim() || undefined,
      awsRoleArn: parsed.awsRoleArn?.trim() || undefined,
      defaultMarketplace: parsed.defaultMarketplace?.trim().toUpperCase() || undefined,
      sandbox: parsed.sandbox !== false,
      redirectUri: parsed.redirectUri?.trim() || undefined,
      connectedAt: parsed.connectedAt,
      sellerId: parsed.sellerId?.trim() || undefined,
      refreshToken: parsed.refreshToken?.trim() || undefined,
      marketplaceIds: Array.isArray(parsed.marketplaceIds) ? parsed.marketplaceIds : [],
      sellerConnectedAt: parsed.sellerConnectedAt,
    };
  } catch {
    return null;
  }
}

function toSellerConnection(
  record: AmazonWorkspaceConnectionWithSecret | null,
): AmazonWorkspaceSellerConnection | null {
  if (!record?.sellerId && !record?.refreshToken) return null;
  return {
    sellerId: record.sellerId,
    refreshToken: record.refreshToken,
    marketplaceIds: record.marketplaceIds ?? [],
    sellerConnectedAt: record.sellerConnectedAt,
    defaultMarketplace: record.defaultMarketplace,
  };
}

export function isAmazonWorkspaceLegacyAppConfigured(
  record: AmazonWorkspaceConnectionWithSecret | null,
): boolean {
  if (!record) return false;
  return Boolean(record.clientId?.trim() && record.clientSecret?.trim());
}

export type SaveAmazonWorkspaceAppInput = {
  applicationId?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  defaultMarketplace?: string;
  sandbox?: boolean;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRoleArn?: string;
};

export async function saveAmazonWorkspaceAppCredentials(
  workspaceId: number,
  input: SaveAmazonWorkspaceAppInput,
  req?: Request,
): Promise<AmazonWorkspaceConnectionWithSecret> {
  const existing = await readAmazonWorkspaceRecord(workspaceId);
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret?.trim() || existing?.clientSecret?.trim();
  if (!clientId) {
    throw new Error("LWA Client ID is required.");
  }
  if (!clientSecret) {
    throw new Error("LWA Client Secret is required.");
  }

  const redirectUri = input.redirectUri?.trim()
    || existing?.redirectUri?.trim()
    || (req ? buildAmazonOAuthRedirectUri(req) : "");

  const record: AmazonWorkspaceConnectionWithSecret = {
    applicationId: input.applicationId?.trim() || existing?.applicationId,
    clientId,
    clientSecret,
    redirectUri,
    defaultMarketplace: input.defaultMarketplace?.trim().toUpperCase()
      || existing?.defaultMarketplace
      || "US",
    sandbox: input.sandbox ?? existing?.sandbox ?? true,
    awsAccessKeyId: input.awsAccessKeyId?.trim() || existing?.awsAccessKeyId,
    awsSecretAccessKey: input.awsSecretAccessKey?.trim() || existing?.awsSecretAccessKey,
    awsRoleArn: input.awsRoleArn?.trim() || existing?.awsRoleArn,
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    marketplaceIds: existing?.marketplaceIds ?? [],
    sellerId: existing?.sellerId,
    refreshToken: existing?.refreshToken,
    sellerConnectedAt: existing?.sellerConnectedAt,
  };

  await upsertAmazonWorkspaceRecord(workspaceId, record);
  return record;
}

export function workspaceLegacyRecordToSpSettings(
  record: AmazonWorkspaceConnectionWithSecret,
): AmazonSpSettings {
  return {
    enabled: true,
    sandbox: record.sandbox !== false,
    applicationId: record.applicationId ?? "",
    clientId: record.clientId ?? "",
    clientSecret: record.clientSecret ?? "",
    redirectUri: record.redirectUri ?? "",
    defaultMarketplace: record.defaultMarketplace ?? "US",
    awsAccessKeyId: record.awsAccessKeyId ?? "",
    awsSecretAccessKey: record.awsSecretAccessKey ?? "",
    awsRoleArn: record.awsRoleArn ?? "",
  };
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

async function readAmazonWorkspaceRecord(
  workspaceId: number,
): Promise<AmazonWorkspaceConnectionWithSecret | null> {
  const key = amazonConnectionKey(workspaceId);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return parseRawAmazonWorkspaceRecord(row?.value);
}

export async function getAmazonWorkspaceSellerConnection(
  workspaceId: number,
): Promise<AmazonWorkspaceSellerConnection | null> {
  const record = await readAmazonWorkspaceRecord(workspaceId);
  return toSellerConnection(record);
}

export async function getAmazonWorkspaceLegacyAppSettings(
  workspaceId: number,
): Promise<AmazonSpSettings | null> {
  const record = await readAmazonWorkspaceRecord(workspaceId);
  if (!isAmazonWorkspaceLegacyAppConfigured(record)) return null;
  return workspaceLegacyRecordToSpSettings(record!);
}

/** @deprecated Use getAmazonWorkspaceSellerConnection */
export async function getAmazonWorkspaceConnection(
  workspaceId: number,
): Promise<AmazonWorkspaceConnectionWithSecret | null> {
  return readAmazonWorkspaceRecord(workspaceId);
}

async function upsertAmazonWorkspaceRecord(
  workspaceId: number,
  record: AmazonWorkspaceConnectionWithSecret,
): Promise<AmazonWorkspaceConnectionWithSecret> {
  const key = amazonConnectionKey(workspaceId);
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

export async function saveAmazonWorkspaceSellerConnection(
  workspaceId: number,
  input: { sellerId: string; refreshToken: string; marketplaceIds?: string[] },
): Promise<AmazonWorkspaceSellerConnection> {
  const existing = await readAmazonWorkspaceRecord(workspaceId);
  const record: AmazonWorkspaceConnectionWithSecret = {
    ...existing,
    sellerId: input.sellerId.trim(),
    refreshToken: input.refreshToken.trim(),
    marketplaceIds: input.marketplaceIds ?? existing?.marketplaceIds ?? [],
    sellerConnectedAt: new Date().toISOString(),
    defaultMarketplace: existing?.defaultMarketplace,
  };

  await upsertAmazonWorkspaceRecord(workspaceId, record);
  return toSellerConnection(record)!;
}

export async function disconnectAmazonWorkspaceSellerConnection(workspaceId: number): Promise<void> {
  const existing = await readAmazonWorkspaceRecord(workspaceId);
  if (!existing) return;

  const record: AmazonWorkspaceConnectionWithSecret = {
    applicationId: existing.applicationId,
    clientId: existing.clientId,
    clientSecret: existing.clientSecret,
    awsAccessKeyId: existing.awsAccessKeyId,
    awsSecretAccessKey: existing.awsSecretAccessKey,
    awsRoleArn: existing.awsRoleArn,
    defaultMarketplace: existing.defaultMarketplace,
    sandbox: existing.sandbox,
    redirectUri: existing.redirectUri,
    connectedAt: existing.connectedAt,
    marketplaceIds: [],
  };

  if (!isAmazonWorkspaceLegacyAppConfigured(record)) {
    const key = amazonConnectionKey(workspaceId);
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    return;
  }

  await upsertAmazonWorkspaceRecord(workspaceId, record);
}

/** @deprecated Alias for disconnectAmazonWorkspaceSellerConnection */
export async function disconnectAmazonWorkspaceConnection(workspaceId: number): Promise<void> {
  await disconnectAmazonWorkspaceSellerConnection(workspaceId);
}
