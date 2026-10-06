import { createHash } from "node:crypto";

/** Default endpoint for eBay Developer Portal challenge (staging). Override in production via env. */
export const DEFAULT_EBAY_MARKETPLACE_DELETION_ENDPOINT =
  "https://test.sellerlens.io/api/ebay/marketplace-account-deletion";

export type EbayMarketplaceAccountDeletionNotification = {
  metadata?: {
    topic?: string;
    schemaVersion?: string;
    deprecated?: boolean;
  };
  notification?: {
    notificationId?: string;
    eventDate?: string;
    publishDate?: string;
    publishAttemptCount?: number;
    data?: {
      username?: string;
      userId?: string;
      eiasToken?: string;
    };
  };
};

export function resolveEbayMarketplaceDeletionVerificationToken(): string | null {
  const token = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN?.trim();
  return token || null;
}

export function resolveEbayMarketplaceDeletionEndpoint(): string {
  const fromEnv = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT?.trim();
  return fromEnv || DEFAULT_EBAY_MARKETPLACE_DELETION_ENDPOINT;
}

/**
 * eBay Marketplace Account Deletion challenge response.
 * Hash input order: challengeCode + verificationToken + endpoint (no separators).
 */
export function computeMarketplaceDeletionChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpoint: string,
): string {
  return createHash("sha256")
    .update(challengeCode + verificationToken + endpoint, "utf8")
    .digest("hex");
}

export type MarketplaceDeletionLog = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
};

export type ProcessDeletionNotificationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function processEbayMarketplaceAccountDeletionNotification(
  body: unknown,
  log: MarketplaceDeletionLog,
): ProcessDeletionNotificationResult {
  const payload = body as EbayMarketplaceAccountDeletionNotification;
  const topic = payload?.metadata?.topic?.trim();
  if (topic !== "MARKETPLACE_ACCOUNT_DELETION") {
    return { ok: false, status: 400, error: "Invalid notification topic" };
  }

  const notificationId = payload.notification?.notificationId?.trim() ?? "";
  const ebayUserId = payload.notification?.data?.userId?.trim() ?? "";
  const publishAttemptCount = payload.notification?.publishAttemptCount;

  log.info(
    {
      notificationId,
      ebayUserId,
      publishAttemptCount,
    },
    "eBay marketplace account deletion notification received",
  );

  queueEbayMarketplaceAccountDeletionWork({
    notificationId,
    ebayUserId,
    eiasToken: payload.notification?.data?.eiasToken?.trim() ?? "",
    eventDate: payload.notification?.eventDate,
    publishDate: payload.notification?.publishDate,
  });

  return { ok: true };
}

export type EbayDeletionWorkItem = {
  notificationId: string;
  ebayUserId: string;
  /** Present for future workspace mapping — never log. */
  eiasToken: string;
  eventDate?: string;
  publishDate?: string;
};

/**
 * TODO(account-deletion): Validate `X-EBAY-SIGNATURE` on POST before processing production events.
 * See eBay Notification API signature verification docs.
 *
 * TODO(account-deletion): Map `ebayUserId` / `eiasToken` to SellerLens workspace connections
 * (`marketplace_connection_*_ebay` settings) and user records; disconnect eBay, anonymize or delete
 * imported listing data, orders, and tokens per privacy policy. Do not run destructive deletes until
 * mapping and audit requirements are defined.
 */
export function queueEbayMarketplaceAccountDeletionWork(_item: EbayDeletionWorkItem): void {
  // Intentionally no-op for initial release.
}
