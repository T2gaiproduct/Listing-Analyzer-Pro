import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, settingsTable } from "@workspace/db";
import {
  getAmazonWorkspaceConnection,
  type AmazonWorkspaceConnectionWithSecret,
} from "./amazon-workspace-connection.js";

export type AmazonAdsWorkspaceSettings = {
  profileId?: string;
  profileCountryCode?: string;
  profileCurrencyCode?: string;
  profileName?: string;
  connectedAt?: string;
};

function adsSettingsKey(workspaceId: number): string {
  return `amazon_ads_${workspaceId}`;
}

export async function getAmazonAdsWorkspaceSettings(
  workspaceId: number,
): Promise<AmazonAdsWorkspaceSettings | null> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, adsSettingsKey(workspaceId)));
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as AmazonAdsWorkspaceSettings;
  } catch {
    return null;
  }
}

export async function saveAmazonAdsProfile(
  workspaceId: number,
  input: {
    profileId: string;
    profileCountryCode?: string;
    profileCurrencyCode?: string;
    profileName?: string;
  },
): Promise<AmazonAdsWorkspaceSettings> {
  const record: AmazonAdsWorkspaceSettings = {
    profileId: input.profileId.trim(),
    profileCountryCode: input.profileCountryCode,
    profileCurrencyCode: input.profileCurrencyCode,
    profileName: input.profileName,
    connectedAt: new Date().toISOString(),
  };

  const key = adsSettingsKey(workspaceId);
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing) {
    await db.update(settingsTable)
      .set({ value: JSON.stringify(record), updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({
      key,
      value: JSON.stringify(record),
      category: "amazon_ads",
      isSecret: false,
    });
  }
  return record;
}

export async function canUseAmazonAds(workspaceId: number): Promise<{
  spApiReady: boolean;
  sellerConnected: boolean;
  profileSelected: boolean;
  profileId?: string;
  amazonRecord: AmazonWorkspaceConnectionWithSecret | null;
}> {
  const amazonRecord = await getAmazonWorkspaceConnection(workspaceId);
  const sellerConnected = Boolean(
    amazonRecord?.sellerId?.trim() && amazonRecord?.refreshToken?.trim(),
  );
  const spApiReady = Boolean(
    amazonRecord?.appCredentialsSavedAt?.trim()
    && amazonRecord?.clientId?.trim()
    && amazonRecord?.clientSecret?.trim(),
  );
  const adsSettings = await getAmazonAdsWorkspaceSettings(workspaceId);

  return {
    spApiReady,
    sellerConnected,
    profileSelected: Boolean(adsSettings?.profileId?.trim()),
    profileId: adsSettings?.profileId,
    amazonRecord,
  };
}

import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";

export function buildAmazonAdsRedirectUri(req: Request): string {
  return `${resolvePublicBaseUrl(req)}/api/ads/oauth/callback`;
}
