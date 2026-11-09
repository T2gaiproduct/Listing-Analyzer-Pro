import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { notifyAdminUsers } from "./notify-admins.js";
import {
  fetchOpenAiBillingStatus,
  getOpenAiLowBalanceThresholdUsd,
  type OpenAiBillingScope,
  type OpenAiBillingStatus,
} from "./openai-billing.js";

const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

type NotifyState = {
  lowAt?: string;
  depletedAt?: string;
  contentQuotaAt?: string;
  imageQuotaAt?: string;
};

async function readNotifyState(): Promise<NotifyState> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "openai_billing_notify_state"))
    .limit(1);
  if (!row?.value) return {};
  try {
    return JSON.parse(row.value) as NotifyState;
  } catch {
    return {};
  }
}

async function writeNotifyState(state: NotifyState): Promise<void> {
  const value = JSON.stringify(state);
  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "openai_billing_notify_state"))
    .limit(1);
  if (existing) {
    await db
      .update(settingsTable)
      .set({ value })
      .where(eq(settingsTable.key, "openai_billing_notify_state"));
  } else {
    await db.insert(settingsTable).values({
      key: "openai_billing_notify_state",
      value,
      category: "ai",
      isSecret: 0,
    });
  }
}

function withinCooldown(iso: string | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < NOTIFY_COOLDOWN_MS;
}

function scopeLabel(scope: OpenAiBillingScope): string {
  return scope === "image" ? "Image generation" : "Content generation";
}

export function isOpenAiBillingExhaustedError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  return (
    lower.includes("insufficient_quota")
    || lower.includes("no credits remaining")
    || (lower.includes("billing") && (raw.includes("429") || lower.includes("exceeded")))
    || lower.includes("spend limit")
    || (lower.includes("exceeded your current quota") && lower.includes("openai"))
  );
}

export async function notifyAdminsOpenAiBillingFromError(
  scope: OpenAiBillingScope,
  err: unknown,
): Promise<void> {
  if (!isOpenAiBillingExhaustedError(err)) return;

  const state = await readNotifyState();
  const key = scope === "image" ? "imageQuotaAt" : "contentQuotaAt";
  if (withinCooldown(state[key])) return;

  const label = scopeLabel(scope);
  await notifyAdminUsers({
    type: "openai_credits_depleted",
    title: `OpenAI credits blocking ${label.toLowerCase()}`,
    message: `${label} failed because the connected OpenAI account has no usable billing quota. Add funds or raise limits in OpenAI, then verify under Admin → AI Settings.`,
    link: "/admin/settings/ai",
  });

  state[key] = new Date().toISOString();
  await writeNotifyState(state);
}

async function notifyFromProactiveStatus(status: OpenAiBillingStatus): Promise<void> {
  const state = await readNotifyState();

  if (status.level === "depleted" && !withinCooldown(state.depletedAt)) {
    await notifyAdminUsers({
      type: "openai_credits_depleted",
      title: "OpenAI prepaid credits depleted",
      message:
        status.detail
        ?? "Connected OpenAI prepaid balance is $0. Content and image generation will fail until billing is topped up.",
      link: "/admin/settings/ai",
    });
    state.depletedAt = new Date().toISOString();
    await writeNotifyState(state);
    return;
  }

  if (status.level === "low" && !withinCooldown(state.lowAt)) {
    const remaining =
      status.availableUsd != null ? `$${status.availableUsd.toFixed(2)}` : "below your threshold";
    const threshold = status.lowThresholdUsd;
    await notifyAdminUsers({
      type: "openai_credits_low",
      title: "OpenAI credits running low",
      message: `Prepaid balance is ${remaining} (alert threshold $${threshold.toFixed(2)}). Top up OpenAI billing before content and image generation are interrupted.`,
      link: "/admin/settings/ai",
    });
    state.lowAt = new Date().toISOString();
    await writeNotifyState(state);
  }
}

/** Refresh billing from OpenAI when possible and notify admins if low/depleted. */
export async function checkOpenAiBillingAndNotifyAdmins(): Promise<OpenAiBillingStatus> {
  const status = await fetchOpenAiBillingStatus();
  await notifyFromProactiveStatus(status);
  return status;
}

export async function ensureOpenAiLowThresholdInSettings(value?: string): Promise<number> {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    const [existing] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "openai_low_balance_usd"))
      .limit(1);
    const str = String(parsed);
    if (existing) {
      await db.update(settingsTable).set({ value: str }).where(eq(settingsTable.key, "openai_low_balance_usd"));
    } else {
      await db.insert(settingsTable).values({
        key: "openai_low_balance_usd",
        value: str,
        category: "ai",
        isSecret: 0,
      });
    }
    return parsed;
  }
  return getOpenAiLowBalanceThresholdUsd();
}
