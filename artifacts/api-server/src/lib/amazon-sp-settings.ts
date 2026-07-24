import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export const AMAZON_SETTINGS_CATEGORY = "amazon";

export const AMAZON_SETTING_KEYS = {
  enabled: "amazon_sp_enabled",
  sandbox: "amazon_sp_sandbox",
  clientId: "amazon_sp_client_id",
  clientSecret: "amazon_sp_client_secret",
  redirectUri: "amazon_sp_redirect_uri",
  defaultMarketplace: "amazon_sp_default_marketplace",
  awsAccessKeyId: "amazon_aws_access_key_id",
  awsSecretAccessKey: "amazon_aws_secret_access_key",
  awsRoleArn: "amazon_aws_role_arn",
} as const;

export interface AmazonSpSettings {
  enabled: boolean;
  sandbox: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  defaultMarketplace: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRoleArn: string;
}

const DEFAULTS: AmazonSpSettings = {
  enabled: false,
  sandbox: true,
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  defaultMarketplace: "US",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRoleArn: "",
};

export async function loadAmazonSpSettings(): Promise<AmazonSpSettings> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.category, AMAZON_SETTINGS_CATEGORY));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(AMAZON_SETTING_KEYS.enabled) === "true",
    sandbox: map.get(AMAZON_SETTING_KEYS.sandbox) !== "false",
    clientId: map.get(AMAZON_SETTING_KEYS.clientId) ?? DEFAULTS.clientId,
    clientSecret: map.get(AMAZON_SETTING_KEYS.clientSecret) ?? DEFAULTS.clientSecret,
    redirectUri: map.get(AMAZON_SETTING_KEYS.redirectUri) ?? DEFAULTS.redirectUri,
    defaultMarketplace: map.get(AMAZON_SETTING_KEYS.defaultMarketplace) ?? DEFAULTS.defaultMarketplace,
    awsAccessKeyId: map.get(AMAZON_SETTING_KEYS.awsAccessKeyId) ?? DEFAULTS.awsAccessKeyId,
    awsSecretAccessKey: map.get(AMAZON_SETTING_KEYS.awsSecretAccessKey) ?? DEFAULTS.awsSecretAccessKey,
    awsRoleArn: map.get(AMAZON_SETTING_KEYS.awsRoleArn) ?? DEFAULTS.awsRoleArn,
  };
}

export function isAmazonSpConfigured(settings: AmazonSpSettings): boolean {
  return Boolean(
    settings.enabled
    && settings.clientId.trim()
    && settings.clientSecret.trim()
    && settings.redirectUri.trim(),
  );
}

export function canSignSpApiRequests(settings: AmazonSpSettings): boolean {
  if (settings.awsRoleArn.trim() && settings.awsAccessKeyId.trim() && settings.awsSecretAccessKey.trim()) {
    return true;
  }
  return Boolean(settings.awsAccessKeyId.trim() && settings.awsSecretAccessKey.trim());
}

export const AMAZON_MARKETPLACE_SP_IDS: Record<string, string> = {
  US: "ATVPDKIKX0DER",
  CA: "A2EUQ1WTGCTBG2",
  MX: "A1AM78C64UM0Y8",
  UK: "A1F83G8C2ARO7P",
  DE: "A1PA6795UKMFR9",
  FR: "A13V1IB3VIYZZH",
  IT: "APJ6JRA9NG5V4",
  ES: "A1RKKUPIHCS9HS",
  NL: "A1805IZSGTT6HS",
  SE: "A2NODRKZP88ZB9",
  PL: "A1C3SOZRARQ6R3",
  BE: "AMEN7PMS3EDWL",
  IN: "A21TJRUUN4KGV",
  JP: "A1VC38T7YXB528",
  AU: "A39IBJ37TRP1C6",
  SG: "A19VAU5U5O7RUS",
  AE: "A2VIGQ35RCS4UG",
  SA: "A17E79C6D8DWNP",
  TR: "A33AVAJ2PDY3EV",
  BR: "A2Q3Y263D00KWC",
};

export function resolveSpMarketplaceId(marketplaceCode: string): string {
  const code = marketplaceCode.trim().toUpperCase();
  return AMAZON_MARKETPLACE_SP_IDS[code] ?? AMAZON_MARKETPLACE_SP_IDS.US!;
}

export function spApiHost(settings: AmazonSpSettings, region: "na" | "eu" | "fe" = "na"): string {
  const prefix = settings.sandbox ? "sandbox." : "";
  return `https://${prefix}sellingpartnerapi-${region}.amazon.com`;
}
