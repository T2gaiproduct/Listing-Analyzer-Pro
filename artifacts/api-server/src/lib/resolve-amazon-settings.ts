import { and, eq } from "drizzle-orm";
import { db, amazonSellerConnectionsTable } from "@workspace/db";
import {
  getAmazonWorkspaceConnection,
  isAmazonWorkspaceCredentialsReady,
  isAmazonWorkspacePublishReady,
  workspaceConnectionToSpSettings,
  type AmazonWorkspaceConnectionWithSecret,
} from "./amazon-workspace-connection.js";
import {
  canSignSpApiRequests,
  ensureAmazonAutoEnabled,
  isAmazonLwaConfigured,
  isAmazonPublishReady,
  isAmazonSpConfigured,
  loadAmazonSpSettings,
  type AmazonSpSettings,
} from "./amazon-sp-settings.js";

export type ResolvedAmazonConnection = {
  settings: AmazonSpSettings;
  sellerId: string;
  refreshToken: string;
  marketplaceIds: string[];
  source: "workspace" | "global";
};

export async function resolveAmazonSettingsForWorkspace(
  workspaceId: number | null | undefined,
): Promise<{ settings: AmazonSpSettings; source: "workspace" | "global" }> {
  if (workspaceId) {
    const workspaceConnection = await getAmazonWorkspaceConnection(workspaceId);
    if (isAmazonWorkspaceCredentialsReady(workspaceConnection)) {
      return {
        settings: workspaceConnectionToSpSettings(workspaceConnection!),
        source: "workspace",
      };
    }
  }

  const settings = await ensureAmazonAutoEnabled();
  return { settings, source: "global" };
}

export async function resolveAmazonConnectionForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
}): Promise<ResolvedAmazonConnection | null> {
  if (opts.workspaceId) {
    const workspaceConnection = await getAmazonWorkspaceConnection(opts.workspaceId);
    if (isAmazonWorkspacePublishReady(workspaceConnection)) {
      return workspaceConnectionToResolved(workspaceConnection!, "workspace");
    }
  }

  const settings = await ensureAmazonAutoEnabled();
  if (!isAmazonPublishReady(settings)) return null;

  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(and(
      eq(amazonSellerConnectionsTable.userId, opts.userId),
      eq(amazonSellerConnectionsTable.isDeleted, 0),
    ))
    .limit(1);

  if (!connection) return null;

  return {
    settings,
    sellerId: connection.sellerId,
    refreshToken: connection.refreshToken,
    marketplaceIds: connection.marketplaceIds ?? [],
    source: "global",
  };
}

function workspaceConnectionToResolved(
  connection: AmazonWorkspaceConnectionWithSecret,
  source: "workspace",
): ResolvedAmazonConnection {
  return {
    settings: workspaceConnectionToSpSettings(connection),
    sellerId: connection.sellerId!,
    refreshToken: connection.refreshToken!,
    marketplaceIds: connection.marketplaceIds ?? [],
    source,
  };
}

export async function loadAmazonConnectionStatusForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
}) {
  const workspaceConnection = opts.workspaceId
    ? await getAmazonWorkspaceConnection(opts.workspaceId)
    : null;
  const workspaceCredentialsReady = isAmazonWorkspaceCredentialsReady(workspaceConnection);
  const workspacePublishReady = isAmazonWorkspacePublishReady(workspaceConnection);
  const workspaceSellerConnected = Boolean(workspaceConnection?.sellerId && workspaceConnection.refreshToken);

  if (workspaceCredentialsReady && workspaceConnection) {
    return {
      configured: true,
      publishReady: workspacePublishReady,
      enabled: true,
      sandbox: workspaceConnection.sandbox,
      canSignRequests: canSignSpApiRequests(workspaceConnectionToSpSettings(workspaceConnection)),
      connected: workspaceSellerConnected,
      sellerId: workspaceConnection.sellerId ?? null,
      marketplaceIds: workspaceConnection.marketplaceIds ?? [],
      defaultMarketplace: workspaceConnection.defaultMarketplace,
      source: "workspace" as const,
      credentialsReady: true,
      redirectUri: workspaceConnection.redirectUri,
    };
  }

  const settings = await ensureAmazonAutoEnabled();
  const [connection] = await db
    .select()
    .from(amazonSellerConnectionsTable)
    .where(and(
      eq(amazonSellerConnectionsTable.userId, opts.userId),
      eq(amazonSellerConnectionsTable.isDeleted, 0),
    ))
    .limit(1);

  return {
    configured: isAmazonSpConfigured(settings),
    publishReady: isAmazonPublishReady(settings),
    enabled: settings.enabled,
    sandbox: settings.sandbox,
    canSignRequests: canSignSpApiRequests(settings),
    connected: Boolean(connection),
    sellerId: connection?.sellerId ?? null,
    marketplaceIds: connection?.marketplaceIds ?? [],
    defaultMarketplace: settings.defaultMarketplace,
    source: "global" as const,
    credentialsReady: isAmazonLwaConfigured(settings),
    redirectUri: settings.redirectUri || null,
  };
}
