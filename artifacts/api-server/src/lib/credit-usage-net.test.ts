import assert from "node:assert/strict";
import { aggregateUsage, spentForFeatureTypes } from "./credit-usage-net.js";

function testAggregateMatchesTotalAndFeatureRows(): void {
  const usage = aggregateUsage([
    { id: 1, amount: -1, featureType: "audit", createdAt: "2026-09-01T00:00:00.000Z" },
    { id: 2, amount: -8, featureType: "images", createdAt: "2026-08-01T00:00:00.000Z" },
    { id: 3, amount: 50, featureType: "subscription", createdAt: "2026-08-01T00:00:00.000Z" },
    { id: 4, amount: -5, featureType: "workspace_pool_transfer", createdAt: "2026-08-01T00:00:00.000Z" },
  ]);
  assert.equal(usage.totalSpent, 9);
  assert.equal(spentForFeatureTypes(usage.spentByFeatureType, ["audit", "competitors"]), 1);
  assert.equal(spentForFeatureTypes(usage.spentByFeatureType, ["images", "graphics"]), 8);
  assert.equal(
    spentForFeatureTypes(usage.spentByFeatureType, ["audit", "competitors"])
      + spentForFeatureTypes(usage.spentByFeatureType, ["images", "graphics"]),
    usage.totalSpent,
  );
}

testAggregateMatchesTotalAndFeatureRows();
console.log("credit-usage-net: total matches feature breakdown");
