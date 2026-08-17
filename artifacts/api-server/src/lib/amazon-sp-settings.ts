import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export const AMAZON_SETTINGS_CATEGORY = "amazon";

export const AMAZON_SETTING_KEYS = {
  enabled: "amazon_sp_enabled",
  sandbox: "amazon_sp_sandbox",
  applicationId: "amazon_sp_application_id",
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
  applicationId: string;
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
  applicationId: "",
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
  const fromDb: AmazonSpSettings = {
    enabled: map.get(AMAZON_SETTING_KEYS.enabled) === "true",
    sandbox: map.get(AMAZON_SETTING_KEYS.sandbox) !== "false",
    applicationId: map.get(AMAZON_SETTING_KEYS.applicationId) ?? DEFAULTS.applicationId,
    clientId: map.get(AMAZON_SETTING_KEYS.clientId) ?? DEFAULTS.clientId,
    clientSecret: map.get(AMAZON_SETTING_KEYS.clientSecret) ?? DEFAULTS.clientSecret,
    redirectUri: map.get(AMAZON_SETTING_KEYS.redirectUri) ?? DEFAULTS.redirectUri,
    defaultMarketplace: map.get(AMAZON_SETTING_KEYS.defaultMarketplace) ?? DEFAULTS.defaultMarketplace,
    awsAccessKeyId: map.get(AMAZON_SETTING_KEYS.awsAccessKeyId) ?? DEFAULTS.awsAccessKeyId,
    awsSecretAccessKey: map.get(AMAZON_SETTING_KEYS.awsSecretAccessKey) ?? DEFAULTS.awsSecretAccessKey,
    awsRoleArn: map.get(AMAZON_SETTING_KEYS.awsRoleArn) ?? DEFAULTS.awsRoleArn,
  };

  return mergeAmazonSpSettingsFromEnv(fromDb);
}

function envValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function mergeAmazonSpSettingsFromEnv(settings: AmazonSpSettings): AmazonSpSettings {
  const enabledEnv = process.env.AMAZON_SP_ENABLED?.trim().toLowerCase();
  const sandboxEnv = process.env.AMAZON_SP_SANDBOX?.trim().toLowerCase();

  return {
    enabled: enabledEnv === "true" ? true : enabledEnv === "false" ? false : settings.enabled,
    sandbox: sandboxEnv === "false" ? false : sandboxEnv === "true" ? true : settings.sandbox,
    applicationId: settings.applicationId || envValue("AMAZON_SP_APPLICATION_ID"),
    clientId: settings.clientId || envValue("AMAZON_SP_CLIENT_ID"),
    clientSecret: settings.clientSecret || envValue("AMAZON_SP_CLIENT_SECRET"),
    redirectUri: settings.redirectUri || envValue("AMAZON_SP_REDIRECT_URI"),
    defaultMarketplace: settings.defaultMarketplace || envValue("AMAZON_SP_DEFAULT_MARKETPLACE") || DEFAULTS.defaultMarketplace,
    awsAccessKeyId: settings.awsAccessKeyId || envValue("AMAZON_AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
    awsSecretAccessKey: settings.awsSecretAccessKey || envValue("AMAZON_AWS_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"),
    awsRoleArn: settings.awsRoleArn || envValue("AMAZON_AWS_ROLE_ARN", "AWS_ROLE_ARN"),
  };
}

export function isAmazonLwaConfigured(settings: AmazonSpSettings): boolean {
  return Boolean(
    settings.clientId.trim()
    && settings.clientSecret.trim()
    && settings.redirectUri.trim()
    && settings.applicationId.trim(),
  );
}

export function validateAmazonAwsCredentials(settings: AmazonSpSettings): string | null {
  const accessKey = settings.awsAccessKeyId.trim();
  const secretKey = settings.awsSecretAccessKey.trim();
  if (!accessKey && !secretKey) return null;
  if (accessKey.startsWith("amzn1.") || secretKey.startsWith("amzn1.")) {
    return "AWS keys look like Amazon app IDs. Use IAM Access Key ID (starts with AKIA…) and Secret Access Key from AWS, and put your SP-API Application ID (amzn1.sp.solution.…) in the Application ID field.";
  }
  if (accessKey && !/^AKIA[0-9A-Z]{16}$/.test(accessKey)) {
    return "AWS Access Key ID should start with AKIA and be 20 characters. Find it in AWS IAM or your SP-API developer registration — not in LWA credentials.";
  }
  if (secretKey && secretKey.length < 20) {
    return "AWS Secret Access Key looks too short. Copy the full 40-character secret from AWS IAM.";
  }
  if (accessKey && !secretKey) {
    return "AWS Secret Access Key is required when an Access Key ID is set.";
  }
  if (secretKey && !accessKey) {
    return "AWS Access Key ID is required when a Secret Access Key is set.";
  }
  return null;
}

/** LWA credentials saved (legacy name used by routes). */
export function isAmazonSpConfigured(settings: AmazonSpSettings): boolean {
  return isAmazonLwaConfigured(settings);
}

export function canSignSpApiRequests(settings: AmazonSpSettings): boolean {
  if (settings.awsRoleArn.trim() && settings.awsAccessKeyId.trim() && settings.awsSecretAccessKey.trim()) {
    return true;
  }
  return Boolean(settings.awsAccessKeyId.trim() && settings.awsSecretAccessKey.trim());
}

/** True when sellers can connect + publish (admin completed setup). */
export function isAmazonPublishReady(settings: AmazonSpSettings): boolean {
  return settings.enabled && isAmazonLwaConfigured(settings) && canSignSpApiRequests(settings);
}

export function shouldAutoEnableAmazon(settings: AmazonSpSettings): boolean {
  return isAmazonLwaConfigured(settings) && canSignSpApiRequests(settings);
}

export async function ensureAmazonAutoEnabled(): Promise<AmazonSpSettings> {
  const settings = await loadAmazonSpSettings();
  if (settings.enabled || !shouldAutoEnableAmazon(settings)) return settings;

  const key = AMAZON_SETTING_KEYS.enabled;
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing) {
    await db.update(settingsTable)
      .set({ value: "true", category: AMAZON_SETTINGS_CATEGORY, updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({
      key,
      value: "true",
      category: AMAZON_SETTINGS_CATEGORY,
      isSecret: false,
    });
  }
  return { ...settings, enabled: true };
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

export function resolveMarketplaceCodeFromSpId(spMarketplaceId: string): string {
  const id = spMarketplaceId.trim();
  for (const [code, spId] of Object.entries(AMAZON_MARKETPLACE_SP_IDS)) {
    if (spId === id) return code;
  }
  return "US";
}

export function spApiRegionForMarketplaceCode(marketplaceCode: string): "na" | "eu" | "fe" {
  const code = marketplaceCode.trim().toUpperCase();
  const eu = new Set(["UK", "DE", "FR", "IT", "ES", "NL", "SE", "PL", "BE", "TR"]);
  const fe = new Set(["JP", "AU", "SG", "IN"]);
  if (eu.has(code)) return "eu";
  if (fe.has(code)) return "fe";
  return "na";
}

export function spApiHost(settings: AmazonSpSettings, region: "na" | "eu" | "fe" = "na"): string {
  const prefix = settings.sandbox ? "sandbox." : "";
  return `https://${prefix}sellingpartnerapi-${region}.amazon.com`;
}
