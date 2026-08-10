import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, settingsTable } from "@workspace/db";
import type { AmazonSpSettings } from "./amazon-sp-settings.js";
import { validateAmazonAwsCredentials } from "./amazon-sp-settings.js";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";

export type AmazonWorkspaceConnectionWithSecret = {
  applicationId: string;
  clientId: string;
  clientSecret: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRoleArn: string;
  defaultMarketplace: string;
  sandbox: boolean;
  redirectUri: string;
  connectedAt: string;
  sellerId?: string;
  refreshToken?: string;
  marketplaceIds: string[];
  sellerConnectedAt?: string;
};

export type AmazonWorkspaceConnectionPublic = {
  applicationId: string;
  clientId: string;
  awsAccessKeyId: string;
  defaultMarketplace: string;
  sandbox: boolean;
  redirectUri: string;
  connectedAt: string;
  sellerId?: string;
  marketplaceIds: string[];
  sellerConnectedAt?: string;
};

function amazonConnectionKey(workspaceId: number): string {
  return `marketplace_connection_${workspaceId}_amazon`;
}

function parseAmazonConnection(raw: string | null | undefined): AmazonWorkspaceConnectionWithSecret | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AmazonWorkspaceConnectionWithSecret;
    if (!parsed.clientId?.trim() || !parsed.clientSecret?.trim()) return null;
    return {
      applicationId: parsed.applicationId?.trim() ?? "",
      clientId: parsed.clientId.trim(),
      clientSecret: parsed.clientSecret.trim(),
      awsAccessKeyId: parsed.awsAccessKeyId?.trim() ?? "",
      awsSecretAccessKey: parsed.awsSecretAccessKey?.trim() ?? "",
      awsRoleArn: parsed.awsRoleArn?.trim() ?? "",
      defaultMarketplace: parsed.defaultMarketplace?.trim() || "US",
      sandbox: parsed.sandbox !== false,
      redirectUri: parsed.redirectUri?.trim() ?? "",
      connectedAt: parsed.connectedAt ?? new Date().toISOString(),
      sellerId: parsed.sellerId?.trim() || undefined,
      refreshToken: parsed.refreshToken?.trim() || undefined,
      marketplaceIds: Array.isArray(parsed.marketplaceIds) ? parsed.marketplaceIds : [],
      sellerConnectedAt: parsed.sellerConnectedAt,
    };
  } catch {
    return null;
  }
}

export function toAmazonWorkspaceConnectionPublic(
  connection: AmazonWorkspaceConnectionWithSecret,
): AmazonWorkspaceConnectionPublic {
  return {
    applicationId: connection.applicationId,
    clientId: connection.clientId,
    awsAccessKeyId: connection.awsAccessKeyId,
    defaultMarketplace: connection.defaultMarketplace,
    sandbox: connection.sandbox,
    redirectUri: connection.redirectUri,
    connectedAt: connection.connectedAt,
    sellerId: connection.sellerId,
    marketplaceIds: connection.marketplaceIds,
    sellerConnectedAt: connection.sellerConnectedAt,
  };
}

export function isAmazonWorkspaceCredentialsReady(
  connection: AmazonWorkspaceConnectionWithSecret | null,
): boolean {
  if (!connection) return false;
  return Boolean(
    connection.applicationId
    && connection.clientId
    && connection.clientSecret
    && connection.redirectUri,
  );
}

export function isAmazonWorkspacePublishReady(
  connection: AmazonWorkspaceConnectionWithSecret | null,
): boolean {
  if (!isAmazonWorkspaceCredentialsReady(connection) || !connection) return false;
  const awsOk = Boolean(connection.awsAccessKeyId && connection.awsSecretAccessKey);
  const sellerOk = Boolean(connection.sellerId && connection.refreshToken);
  return awsOk && sellerOk;
}

export function workspaceConnectionToSpSettings(
  connection: AmazonWorkspaceConnectionWithSecret,
): AmazonSpSettings {
  return {
    enabled: true,
    sandbox: connection.sandbox,
    applicationId: connection.applicationId,
    clientId: connection.clientId,
    clientSecret: connection.clientSecret,
    redirectUri: connection.redirectUri,
    defaultMarketplace: connection.defaultMarketplace,
    awsAccessKeyId: connection.awsAccessKeyId,
    awsSecretAccessKey: connection.awsSecretAccessKey,
    awsRoleArn: connection.awsRoleArn,
  };
}

export function buildAmazonOAuthRedirectUri(req: Request): string {
  const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
  return `${base}/api/amazon/oauth/callback`;
}

export async function getAmazonWorkspaceConnection(
  workspaceId: number,
): Promise<AmazonWorkspaceConnectionWithSecret | null> {
  const key = amazonConnectionKey(workspaceId);
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return parseAmazonConnection(row?.value);
}

export async function getAmazonWorkspaceConnectionPublic(
  workspaceId: number,
): Promise<AmazonWorkspaceConnectionPublic | null> {
  const connection = await getAmazonWorkspaceConnection(workspaceId);
  return connection ? toAmazonWorkspaceConnectionPublic(connection) : null;
}

export async function saveAmazonWorkspaceConnection(
  workspaceId: number,
  input: {
    applicationId: string;
    clientId: string;
    clientSecret: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsRoleArn?: string;
    defaultMarketplace?: string;
    sandbox?: boolean;
    redirectUri: string;
  },
): Promise<AmazonWorkspaceConnectionPublic> {
  const awsError = validateAmazonAwsCredentials({
    enabled: true,
    sandbox: input.sandbox !== false,
    applicationId: input.applicationId,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    defaultMarketplace: input.defaultMarketplace ?? "US",
    awsAccessKeyId: input.awsAccessKeyId,
    awsSecretAccessKey: input.awsSecretAccessKey,
    awsRoleArn: input.awsRoleArn ?? "",
  });
  if (awsError) {
    throw new Error(awsError);
  }

  const existing = await getAmazonWorkspaceConnection(workspaceId);
  const connection: AmazonWorkspaceConnectionWithSecret = {
    applicationId: input.applicationId.trim(),
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    awsAccessKeyId: input.awsAccessKeyId.trim(),
    awsSecretAccessKey: input.awsSecretAccessKey.trim(),
    awsRoleArn: input.awsRoleArn?.trim() ?? "",
    defaultMarketplace: input.defaultMarketplace?.trim().toUpperCase() || "US",
    sandbox: input.sandbox !== false,
    redirectUri: input.redirectUri.trim(),
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    sellerId: existing?.sellerId,
    refreshToken: existing?.refreshToken,
    marketplaceIds: existing?.marketplaceIds ?? [],
    sellerConnectedAt: existing?.sellerConnectedAt,
  };

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

  return toAmazonWorkspaceConnectionPublic(connection);
}

export async function saveAmazonWorkspaceSellerConnection(
  workspaceId: number,
  input: { sellerId: string; refreshToken: string; marketplaceIds?: string[] },
): Promise<AmazonWorkspaceConnectionPublic> {
  const existing = await getAmazonWorkspaceConnection(workspaceId);
  if (!existing) {
    throw new Error("Save Amazon SP-API credentials for this workspace before authorizing your seller account.");
  }

  const connection: AmazonWorkspaceConnectionWithSecret = {
    ...existing,
    sellerId: input.sellerId.trim(),
    refreshToken: input.refreshToken.trim(),
    marketplaceIds: input.marketplaceIds ?? existing.marketplaceIds,
    sellerConnectedAt: new Date().toISOString(),
  };

  const key = amazonConnectionKey(workspaceId);
  await db
    .update(settingsTable)
    .set({ value: JSON.stringify(connection), updatedAt: new Date(), isSecret: true })
    .where(eq(settingsTable.key, key));

  return toAmazonWorkspaceConnectionPublic(connection);
}

export async function disconnectAmazonWorkspaceConnection(workspaceId: number): Promise<void> {
  const key = amazonConnectionKey(workspaceId);
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}
