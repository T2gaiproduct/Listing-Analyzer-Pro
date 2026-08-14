import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, amazonSellerConnectionsTable } from "@workspace/db";
import {
  buildAmazonOAuthRedirectUri,
  getAmazonWorkspaceSellerConnection,
  isAmazonWorkspaceSellerConnected,
  saveAmazonWorkspaceSellerConnection,
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

function withRequestRedirectUri(settings: AmazonSpSettings, req?: Request): AmazonSpSettings {
  if (!req) return settings;
  return {
    ...settings,
    redirectUri: buildAmazonOAuthRedirectUri(req),
  };
}

export async function resolveAmazonSettingsForWorkspace(
  workspaceId: number | null | undefined,
  req?: Request,
): Promise<{ settings: AmazonSpSettings; source: "platform" }> {
  void workspaceId;
  const settings = await ensureAmazonAutoEnabled();
  return {
    settings: withRequestRedirectUri(settings, req),
    source: "platform",
  };
}

export async function resolveAmazonConnectionForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  req?: Request;
}): Promise<ResolvedAmazonConnection | null> {
  const { settings } = await resolveAmazonSettingsForWorkspace(opts.workspaceId, opts.req);
  if (!canSignSpApiRequests(settings)) return null;

  if (opts.workspaceId) {
    const seller = await getAmazonWorkspaceSellerConnection(opts.workspaceId);
    if (isAmazonWorkspaceSellerConnected(seller)) {
      return {
        settings,
        sellerId: seller!.sellerId!,
        refreshToken: seller!.refreshToken!,
        marketplaceIds: seller!.marketplaceIds ?? [],
        source: "workspace",
      };
    }
  }

  const settingsReady = await ensureAmazonAutoEnabled();
  if (!isAmazonPublishReady(settingsReady)) return null;

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
    settings: withRequestRedirectUri(settingsReady, opts.req),
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
  const settings = await ensureAmazonAutoEnabled();
  const platformConfigured = isAmazonLwaConfigured(settings);
  const platformPublishReady = isAmazonPublishReady(settings);

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

  if (platformConfigured) {
    const redirectUri = opts.req
      ? buildAmazonOAuthRedirectUri(opts.req)
      : settings.redirectUri || null;

    return {
      configured: true,
      publishReady: platformPublishReady && sellerConnected,
      enabled: settings.enabled,
      sandbox: settings.sandbox,
      canSignRequests: canSignSpApiRequests(settings),
      connected: sellerConnected,
      sellerId: seller?.sellerId ?? null,
      marketplaceIds: seller?.marketplaceIds ?? [],
      defaultMarketplace: seller?.defaultMarketplace ?? settings.defaultMarketplace,
      source: "platform" as const,
      credentialsReady: true,
      redirectUri,
    };
  }

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

/** Load platform SP-API settings for admin diagnostics. */
export async function loadPlatformAmazonSettings(): Promise<AmazonSpSettings> {
  return loadAmazonSpSettings();
}
