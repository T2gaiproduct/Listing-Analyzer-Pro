import assert from "node:assert/strict";
import { aggregatePeriodUsage, spentForFeatureTypes } from "./credit-usage-net.js";

function testPeriodAggregateIgnoresFundingAndOutsideFeatures(): void {
  const usage = aggregatePeriodUsage([
    { id: 1, amount: -40, featureType: "images", createdAt: "2026-09-26T00:00:00.000Z" },
    { id: 2, amount: -2, featureType: "audit", createdAt: "2026-09-26T00:00:00.000Z" },
    { id: 3, amount: -10, featureType: "subscription", createdAt: "2026-09-26T00:00:00.000Z" },
    { id: 4, amount: 20, featureType: "workspace_pool_transfer", createdAt: "2026-09-26T00:00:00.000Z" },
    { id: 5, amount: -5, featureType: "workspace_pool_transfer", createdAt: "2026-09-26T00:00:00.000Z" },
  ]);
  assert.equal(usage.totalSpent, 42);
  assert.equal(usage.spentByFeatureType.images, 40);
  assert.equal(usage.spentByFeatureType.audit, 2);
  assert.equal(usage.spentByFeatureType.subscription, undefined);
  assert.equal(spentForFeatureTypes(usage.spentByFeatureType, ["audit", "competitors"]), 2);
  assert.equal(spentForFeatureTypes(usage.spentByFeatureType, ["images", "graphics"]), 40);
}

function testRefundedDebitIsExcluded(): void {
  const usage = aggregatePeriodUsage([
    { id: 10, amount: -8, featureType: "graphics", createdAt: "2026-09-26T00:00:00.000Z" },
    {
      id: 11,
      amount: 8,
      featureType: "adjustment",
      createdAt: "2026-09-26T01:00:00.000Z",
      metadata: { refundForTransactionId: 10 },
    },
  ]);
  assert.equal(usage.totalSpent, 0);
  assert.equal(usage.spentByFeatureType.graphics, undefined);
}

testPeriodAggregateIgnoresFundingAndOutsideFeatures();
testRefundedDebitIsExcluded();
console.log("credit-usage-net: period aggregate ok");
