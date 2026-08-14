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
  return Boolean(
    record.applicationId
    && record.clientId
    && record.clientSecret
    && record.redirectUri,
  );
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
  const key = amazonConnectionKey(workspaceId);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}

/** @deprecated Alias for disconnectAmazonWorkspaceSellerConnection */
export async function disconnectAmazonWorkspaceConnection(workspaceId: number): Promise<void> {
  await disconnectAmazonWorkspaceSellerConnection(workspaceId);
}
