import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, amazonSellerConnectionsTable } from "@workspace/db";
import {
  buildAmazonOAuthRedirectUri,
  getAmazonWorkspaceConnection,
  getAmazonWorkspaceLegacyAppSettings,
  getAmazonWorkspaceSellerConnection,
  isAmazonWorkspaceAppCredentialsSaved,
  isAmazonWorkspaceSellerConnected,
  saveAmazonWorkspaceSellerConnection,
  workspaceLegacyRecordToSpSettings,
} from "./amazon-workspace-connection.js";
import {
  canSignSpApiRequests,
  loadAmazonSpSettings,
  type AmazonSpSettings,
} from "./amazon-sp-settings.js";

export type ResolvedAmazonConnection = {
  settings: AmazonSpSettings;
  sellerId: string;
  refreshToken: string;
  marketplaceIds: string[];
  source: "workspace";
};

const EMPTY_AMAZON_SETTINGS: AmazonSpSettings = {
  enabled: false,
  sandbox: true,
  applicationId: "",
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  defaultMarketplace: "US",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRoleArn: "",
};

function withRequestRedirectUri(settings: AmazonSpSettings, req?: Request): AmazonSpSettings {
  const saved = settings.redirectUri.trim();
  // OAuth authorize + token exchange must use the same redirect_uri that is
  // registered in Seller Central — prefer the saved workspace value.
  if (saved) return settings;
  if (!req) return settings;
  return {
    ...settings,
    redirectUri: buildAmazonOAuthRedirectUri(req),
  };
}

async function resolveWorkspaceAmazonSettings(
  workspaceId: number | null | undefined,
  req?: Request,
): Promise<{ settings: AmazonSpSettings; source: "workspace" } | null> {
  if (!workspaceId) return null;

  const legacySettings = await getAmazonWorkspaceLegacyAppSettings(workspaceId);
  if (!legacySettings) return null;

  return {
    settings: withRequestRedirectUri(legacySettings, req),
    source: "workspace",
  };
}

export async function resolveAmazonSettingsForWorkspace(
  workspaceId: number | null | undefined,
  req?: Request,
): Promise<{ settings: AmazonSpSettings; source: "workspace" }> {
  const resolved = await resolveWorkspaceAmazonSettings(workspaceId, req);
  if (resolved) return resolved;

  return {
    settings: withRequestRedirectUri(EMPTY_AMAZON_SETTINGS, req),
    source: "workspace",
  };
}

export async function resolveAmazonConnectionForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  req?: Request;
}): Promise<ResolvedAmazonConnection | null> {
  if (!opts.workspaceId) return null;

  const resolved = await resolveWorkspaceAmazonSettings(opts.workspaceId, opts.req);
  if (!resolved || !canSignSpApiRequests(resolved.settings)) return null;

  const seller = await getAmazonWorkspaceSellerConnection(opts.workspaceId);
  if (!isAmazonWorkspaceSellerConnected(seller)) return null;

  return {
    settings: resolved.settings,
    sellerId: seller!.sellerId!,
    refreshToken: seller!.refreshToken!,
    marketplaceIds: seller!.marketplaceIds ?? [],
    source: "workspace",
  };
}

export async function loadAmazonConnectionStatusForWorkspace(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  req?: Request;
}) {
  const workspaceRecord = opts.workspaceId
    ? await getAmazonWorkspaceConnection(opts.workspaceId)
    : null;
  const workspaceCredentialsSaved = isAmazonWorkspaceAppCredentialsSaved(workspaceRecord);
  const workspaceLegacySettings = workspaceCredentialsSaved && workspaceRecord
    ? workspaceLegacyRecordToSpSettings(workspaceRecord)
    : null;

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
    workspaceCredentialsSaved
    && workspaceLegacySettings
    && canSignSpApiRequests(workspaceLegacySettings)
    && sellerConnected,
  );

  const redirectUri = opts.req
    ? buildAmazonOAuthRedirectUri(opts.req)
    : workspaceLegacySettings?.redirectUri || null;

  const workspaceCanSign = Boolean(
    workspaceCredentialsSaved
    && workspaceLegacySettings
    && canSignSpApiRequests(workspaceLegacySettings),
  );

  return {
    configured: workspaceCredentialsSaved,
    workspaceCredentialsSaved,
    publishReady,
    enabled: workspaceLegacySettings?.enabled ?? false,
    sandbox: workspaceLegacySettings?.sandbox ?? true,
    canSignRequests: workspaceCanSign,
    connected: sellerConnected,
    sellerId: seller?.sellerId ?? null,
    marketplaceIds: seller?.marketplaceIds ?? [],
    defaultMarketplace: seller?.defaultMarketplace
      ?? workspaceLegacySettings?.defaultMarketplace
      ?? "US",
    source: workspaceCredentialsSaved ? "workspace" as const : "global" as const,
    credentialsReady: workspaceCredentialsSaved,
    redirectUri,
    awaitingSellerAuth: workspaceCredentialsSaved && !sellerConnected,
  };
}

/** Load platform SP-API settings for admin diagnostics. */
export async function loadPlatformAmazonSettings(): Promise<AmazonSpSettings> {
  return loadAmazonSpSettings();
}
