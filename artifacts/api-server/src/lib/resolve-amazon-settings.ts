import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, amazonSellerConnectionsTable } from "@workspace/db";
import {
  buildAmazonOAuthRedirectUri,
  getAmazonWorkspaceConnection,
  getAmazonWorkspaceLegacyAppSettings,
  getAmazonWorkspaceSellerConnection,
  isAmazonWorkspaceLegacyAppConfigured,
  isAmazonWorkspaceSellerConnected,
  saveAmazonWorkspaceSellerConnection,
  workspaceLegacyRecordToSpSettings,
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
  source: "workspace" | "global" | "platform";
};

function withRequestRedirectUri(settings: AmazonSpSettings, req?: Request): AmazonSpSettings {
  if (!req) return settings;
  return {
    ...settings,
    redirectUri: buildAmazonOAuthRedirectUri(req),
  };
}

async function resolveWorkspaceAmazonSettings(
  workspaceId: number | null | undefined,
  req?: Request,
): Promise<{ settings: AmazonSpSettings; source: "platform" | "workspace" } | null> {
  if (workspaceId) {
    const legacySettings = await getAmazonWorkspaceLegacyAppSettings(workspaceId);
    if (legacySettings) {
      return {
        settings: withRequestRedirectUri(legacySettings, req),
        source: "workspace",
      };
    }
  }

  const platformSettings = withRequestRedirectUri(await ensureAmazonAutoEnabled(), req);
  if (isAmazonLwaConfigured(platformSettings)) {
    return { settings: platformSettings, source: "platform" };
  }

  return null;
}

export async function resolveAmazonSettingsForWorkspace(
  workspaceId: number | null | undefined,
  req?: Request,
): Promise<{ settings: AmazonSpSettings; source: "platform" | "workspace" }> {
  const resolved = await resolveWorkspaceAmazonSettings(workspaceId, req);
  if (resolved) return resolved;

  return {
    settings: withRequestRedirectUri(await ensureAmazonAutoEnabled(), req),
    source: "platform",
  };
}

export async function resolveAmazonConnectionForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  req?: Request;
}): Promise<ResolvedAmazonConnection | null> {
  const resolved = await resolveWorkspaceAmazonSettings(opts.workspaceId, opts.req);
  if (!resolved || !canSignSpApiRequests(resolved.settings)) return null;

  if (opts.workspaceId) {
    const seller = await getAmazonWorkspaceSellerConnection(opts.workspaceId);
    if (isAmazonWorkspaceSellerConnected(seller)) {
      return {
        settings: resolved.settings,
        sellerId: seller!.sellerId!,
        refreshToken: seller!.refreshToken!,
        marketplaceIds: seller!.marketplaceIds ?? [],
        source: resolved.source,
      };
    }
  }

  const platformSettings = await ensureAmazonAutoEnabled();
  if (!isAmazonPublishReady(platformSettings)) return null;

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
    settings: withRequestRedirectUri(platformSettings, opts.req),
    sellerId: connection.sellerId,
    refreshToken: connection.refreshToken,
    marketplaceIds: connection.marketplaceIds ?? [],
    source: "global",
  };
}

export async function loadAmazonConnectionStatusForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  req?: Request;
}) {
  const platformSettings = await ensureAmazonAutoEnabled();
  const platformConfigured = isAmazonLwaConfigured(platformSettings);
  const workspaceRecord = opts.workspaceId
    ? await getAmazonWorkspaceConnection(opts.workspaceId)
    : null;
  const workspaceLegacyConfigured = isAmazonWorkspaceLegacyAppConfigured(workspaceRecord);
  const workspaceLegacySettings = workspaceLegacyConfigured && workspaceRecord
    ? workspaceLegacyRecordToSpSettings(workspaceRecord)
    : null;

  const activeSettings = workspaceLegacySettings ?? platformSettings;

  const oauthReady = platformConfigured || workspaceLegacyConfigured;

  let seller = opts.workspaceId
    ? await getAmazonWorkspaceSellerConnection(opts.workspaceId)
    : null;
  let sellerConnected = isAmazonWorkspaceSellerConnected(seller);

  if (!sellerConnected && opts.workspaceId) {
    const [legacyConnection] = await db
      .select()
      .from(amazonSellerConnectionsTable)
      .where(and(
        eq(amazonSellerConnectionsTable.userId, opts.userId),
        eq(amazonSellerConnectionsTable.isDeleted, 0),
      ))
      .limit(1);

    if (legacyConnection?.sellerId && legacyConnection.refreshToken) {
      try {
        seller = await saveAmazonWorkspaceSellerConnection(opts.workspaceId, {
          sellerId: legacyConnection.sellerId,
          refreshToken: legacyConnection.refreshToken,
          marketplaceIds: legacyConnection.marketplaceIds ?? [],
        });
        sellerConnected = true;
      } catch {
        // Keep awaiting seller auth if legacy tokens cannot be attached to this workspace.
      }
    }
  }

  const publishReady = Boolean(
    canSignSpApiRequests(activeSettings)
    && sellerConnected
    && (isAmazonPublishReady(platformSettings) || Boolean(
      workspaceLegacySettings?.awsAccessKeyId && workspaceLegacySettings.awsSecretAccessKey,
    )),
  );

  const redirectUri = opts.req
    ? buildAmazonOAuthRedirectUri(opts.req)
    : activeSettings.redirectUri || null;

  return {
    configured: oauthReady,
    publishReady,
    enabled: activeSettings.enabled,
    sandbox: activeSettings.sandbox,
    canSignRequests: canSignSpApiRequests(activeSettings),
    connected: sellerConnected,
    sellerId: seller?.sellerId ?? null,
    marketplaceIds: seller?.marketplaceIds ?? [],
    defaultMarketplace: seller?.defaultMarketplace ?? activeSettings.defaultMarketplace,
    source: workspaceLegacyConfigured ? "workspace" as const : platformConfigured ? "platform" as const : "global" as const,
    credentialsReady: oauthReady,
    redirectUri,
    awaitingSellerAuth: oauthReady && !sellerConnected,
  };
}

/** Load platform SP-API settings for admin diagnostics. */
export async function loadPlatformAmazonSettings(): Promise<AmazonSpSettings> {
  return loadAmazonSpSettings();
}
