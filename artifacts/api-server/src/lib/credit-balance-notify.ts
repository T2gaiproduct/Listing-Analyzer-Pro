import type { CreditType } from "./credits.js";
import { createNotification } from "./notifications.js";

const LOW_THRESHOLD = 5;

export function creditTypeLabel(type: CreditType): string {
  switch (type) {
    case "ai":
      return "AI content";
    case "image":
      return "Image";
    case "audit":
      return "Audit";
    default:
      return type;
  }
}

/** In-app + email (billing prefs) when balance crosses depleted or low thresholds. */
export async function notifyCreditBalanceIfNeeded(
  userId: string,
  type: CreditType,
  remaining: number,
  previousBalance: number,
): Promise<void> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) return;

  const label = creditTypeLabel(type);
  const labelLower = label.toLowerCase();

  if (remaining === 0 && previousBalance > 0) {
    await createNotification({
      userId: trimmedUserId,
      type: "credit_depleted",
      title: `${label} credits depleted`,
      message: `You have no ${labelLower} credits left. Add credits in Billing to continue using ${labelLower} features.`,
      link: "/billing",
    });
    return;
  }

  if (remaining > 0 && remaining <= LOW_THRESHOLD && previousBalance > LOW_THRESHOLD) {
    await createNotification({
      userId: trimmedUserId,
      type: "credit_low",
      title: `Low ${label} credits`,
      message: `You have ${remaining} ${labelLower} credit${remaining === 1 ? "" : "s"} remaining. Add credits in Billing to avoid interruptions.`,
      link: "/billing",
    });
  }
}
