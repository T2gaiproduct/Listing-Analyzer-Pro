import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type OpenAiBillingScope = "content" | "image";

export type OpenAiBillingStatus = {
  checkedAt: string;
  provider: "openai";
  /** Prepaid credits remaining (USD), when credit_grants is available */
  availableUsd: number | null;
  totalGrantedUsd: number | null;
  totalUsedUsd: number | null;
  /** Monthly hard limit from subscription endpoint, when present */
  hardLimitUsd: number | null;
  hasPaymentMethod: boolean | null;
  lowThresholdUsd: number;
  level: "ok" | "low" | "depleted" | "unknown";
  detail?: string;
};

type CreditGrantRow = {
  grant_amount?: number;
  used_amount?: number;
  expires_at?: number | null;
};

async function readSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value?.trim() ?? "";
}

export async function getOpenAiLowBalanceThresholdUsd(): Promise<number> {
  const raw = await readSetting("openai_low_balance_usd");
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return 25;
}

async function getConfiguredOpenAiKey(): Promise<{ apiKey: string; baseUrl: string } | null> {
  const apiKey = await readSetting("openai_api_key");
  if (!apiKey) return null;
  const baseUrl = (await readSetting("openai_base_url")) || "https://api.openai.com/v1";
  return { apiKey, baseUrl };
}

function billingRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

async function dashboardGet<T>(path: string, apiKey: string, baseUrl: string): Promise<T | null> {
  const url = `${billingRoot(baseUrl)}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function sumCreditGrants(data: CreditGrantRow[]): { available: number; granted: number; used: number } {
  const now = Math.floor(Date.now() / 1000);
  let available = 0;
  let granted = 0;
  let used = 0;
  for (const row of data) {
    if (row.expires_at != null && row.expires_at > 0 && row.expires_at < now) continue;
    const g = Number(row.grant_amount ?? 0);
    const u = Number(row.used_amount ?? 0);
    granted += g;
    used += u;
    available += Math.max(0, g - u);
  }
  return { available, granted, used };
}

export async function getCachedOpenAiBillingStatus(): Promise<OpenAiBillingStatus | null> {
  const raw = await readSetting("openai_billing_status_json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OpenAiBillingStatus;
  } catch {
    return null;
  }
}

export async function fetchOpenAiBillingStatus(): Promise<OpenAiBillingStatus> {
  const threshold = await getOpenAiLowBalanceThresholdUsd();
  const checkedAt = new Date().toISOString();
  const config = await getConfiguredOpenAiKey();
  if (!config) {
    return {
      checkedAt,
      provider: "openai",
      availableUsd: null,
      totalGrantedUsd: null,
      totalUsedUsd: null,
      hardLimitUsd: null,
      hasPaymentMethod: null,
      lowThresholdUsd: threshold,
      level: "unknown",
      detail: "OpenAI API key is not configured.",
    };
  }

  const grantsPayload = await dashboardGet<{ data?: CreditGrantRow[] }>(
    "/dashboard/billing/credit_grants",
    config.apiKey,
    config.baseUrl,
  );
  const subscriptionPayload = await dashboardGet<{
    hard_limit_usd?: number;
    has_payment_method?: boolean;
  }>("/dashboard/billing/subscription", config.apiKey, config.baseUrl);

  const grantRows = grantsPayload?.data ?? [];
  const sums = grantRows.length > 0 ? sumCreditGrants(grantRows) : null;

  let availableUsd = sums?.available ?? null;
  let totalGrantedUsd = sums?.granted ?? null;
  let totalUsedUsd = sums?.used ?? null;
  const hardLimitUsd =
    subscriptionPayload?.hard_limit_usd != null
      ? Number(subscriptionPayload.hard_limit_usd)
      : null;
  const hasPaymentMethod =
    subscriptionPayload?.has_payment_method != null
      ? Boolean(subscriptionPayload.has_payment_method)
      : null;

  let level: OpenAiBillingStatus["level"] = "unknown";
  let detail: string | undefined;

  if (availableUsd != null) {
    if (availableUsd <= 0) {
      level = "depleted";
      detail = "Prepaid OpenAI credits are exhausted.";
    } else if (availableUsd <= threshold) {
      level = "low";
      detail = `Prepaid balance is below $${threshold.toFixed(2)}.`;
    } else {
      level = "ok";
    }
  } else if (hardLimitUsd != null && hardLimitUsd <= 0) {
    level = "depleted";
    detail = "OpenAI monthly spending limit is set to $0.";
  } else {
    detail =
      "Live prepaid balance is not exposed for this key (common on usage-based billing). Admins are still alerted when generation fails with quota or billing errors.";
    level = "unknown";
  }

  const status: OpenAiBillingStatus = {
    checkedAt,
    provider: "openai",
    availableUsd,
    totalGrantedUsd,
    totalUsedUsd,
    hardLimitUsd,
    hasPaymentMethod,
    lowThresholdUsd: threshold,
    level,
    detail,
  };

  const snapshot = JSON.stringify(status);
  const [existingStatus] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "openai_billing_status_json"))
    .limit(1);
  if (existingStatus) {
    await db
      .update(settingsTable)
      .set({ value: snapshot, category: "ai" })
      .where(eq(settingsTable.key, "openai_billing_status_json"));
  } else {
    await db.insert(settingsTable).values({
      key: "openai_billing_status_json",
      value: snapshot,
      category: "ai",
      isSecret: false,
    });
  }

  return status;
}
