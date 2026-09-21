import type { CreditType } from "./credits.js";
import { creditTypeLabel } from "./credit-balance-notify.js";
import { createNotification } from "./notifications.js";

export interface CreditUsageInfo {
  creditType: CreditType;
  amount: number;
  featureType: string;
  remaining: number;
  title: string;
  message: string;
}

function activityPhrase(featureType: string, activityName: string): string {
  const name = activityName.trim();
  if (name) return name;
  switch (featureType) {
    case "audit":
      return "auditing your listing";
    case "content":
      return "AI listing content";
    case "ebc":
      return "A+ / EBC content";
    case "images":
      return "listing images";
    case "image_regenerate":
      return "regenerating a listing image";
    case "image_edit":
      return "editing a listing image";
    case "graphics":
      return "create graphics";
    case "graphics_edit":
      return "editing a graphic";
    case "competitors":
      return "competitor analysis";
    case "ads":
    case "manage_ads":
      return "manage ads";
    case "reference_research":
      return "reference intelligence";
    default:
      return featureType.replace(/_/g, " ");
  }
}

export function buildCreditUsageInfo(
  creditType: CreditType,
  amount: number,
  featureType: string,
  activityName: string,
  remaining: number,
): CreditUsageInfo {
  const label = creditTypeLabel(creditType);
  const labelLower = label.toLowerCase();
  const activity = activityPhrase(featureType, activityName);
  const title = `${amount} ${label} credit${amount === 1 ? "" : "s"} used`;
  const message =
    `${amount} ${labelLower} credit${amount === 1 ? "" : "s"} used for ${activity}. `
    + `${remaining} ${labelLower} credit${remaining === 1 ? "" : "s"} remaining.`;
  return {
    creditType,
    amount,
    featureType,
    remaining,
    title,
    message,
  };
}

/** In-app notification, email (billing prefs), and WebSocket toast via createNotification. */
export async function notifyCreditUsed(
  userId: string,
  usage: CreditUsageInfo,
): Promise<void> {
  const trimmed = userId.trim();
  if (!trimmed) return;
  await createNotification({
    userId: trimmed,
    type: "credit_used",
    title: usage.title,
    message: usage.message,
    link: "/billing",
  });
}
