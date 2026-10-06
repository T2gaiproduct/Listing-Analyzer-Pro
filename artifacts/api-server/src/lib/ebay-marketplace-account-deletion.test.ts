import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeMarketplaceDeletionChallengeResponse,
  DEFAULT_EBAY_MARKETPLACE_DELETION_ENDPOINT,
  processEbayMarketplaceAccountDeletionNotification,
} from "./ebay-marketplace-account-deletion.js";

test("computeMarketplaceDeletionChallengeResponse uses challengeCode + token + endpoint order", () => {
  const challengeCode = "abc123";
  const token = "verify-token";
  const endpoint = DEFAULT_EBAY_MARKETPLACE_DELETION_ENDPOINT;
  const expected = computeMarketplaceDeletionChallengeResponse(challengeCode, token, endpoint);
  assert.equal(expected, expected.toLowerCase());
  assert.equal(expected.length, 64);
  // Deterministic re-run
  assert.equal(
    computeMarketplaceDeletionChallengeResponse(challengeCode, token, endpoint),
    expected,
  );
});

test("processEbayMarketplaceAccountDeletionNotification rejects wrong topic", () => {
  const logs: Array<{ obj: Record<string, unknown>; msg: string }> = [];
  const result = processEbayMarketplaceAccountDeletionNotification(
    { metadata: { topic: "OTHER" } },
    {
      info: (obj, msg) => logs.push({ obj, msg }),
      error: () => undefined,
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
  assert.equal(logs.length, 0);
});

test("processEbayMarketplaceAccountDeletionNotification accepts valid topic and omits eiasToken from logs", () => {
  const secretEias = "super-secret-eias-token-value";
  const logs: Array<{ obj: Record<string, unknown>; msg: string }> = [];
  const result = processEbayMarketplaceAccountDeletionNotification(
    {
      metadata: {
        topic: "MARKETPLACE_ACCOUNT_DELETION",
        schemaVersion: "1.0",
        deprecated: false,
      },
      notification: {
        notificationId: "notif-123",
        eventDate: "2026-01-01T00:00:00.000Z",
        publishDate: "2026-01-01T00:00:01.000Z",
        publishAttemptCount: 1,
        data: {
          username: "seller_user",
          userId: "ebay-user-456",
          eiasToken: secretEias,
        },
      },
    },
    {
      info: (obj, msg) => logs.push({ obj, msg }),
      error: () => undefined,
    },
  );
  assert.equal(result.ok, true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.msg, "eBay marketplace account deletion notification received");
  assert.equal(logs[0]?.obj.notificationId, "notif-123");
  assert.equal(logs[0]?.obj.ebayUserId, "ebay-user-456");
  assert.equal(logs[0]?.obj.publishAttemptCount, 1);
  const serialized = JSON.stringify(logs[0]?.obj);
  assert.ok(!serialized.includes(secretEias));
  assert.ok(!serialized.includes("eiasToken"));
});
