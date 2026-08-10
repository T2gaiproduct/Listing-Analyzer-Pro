import assert from "node:assert/strict";
import {
  planHasCapability,
  planIncludesWorkspacesFromPlan,
  defaultEnabledFeaturesForPlanName,
  workspacesUpgradeMessage,
  formatWorkspacesIncludedPlansLabel,
} from "../lib/workspace-permissions/src/plan-capabilities.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log("plan-capabilities tests");

test("legacy fallback: Growth has workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Growth" }), true);
});

test("legacy fallback: Starter has no workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Starter" }), false);
});

test("legacy fallback: Agencies has workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Agencies" }), true);
});

test("admin config wins: explicit false on Pro disables workspaces", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Pro", enabledFeatures: { workspaces: false } }),
    false,
  );
});

test("admin config wins: explicit true on Starter enables workspaces", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Starter", enabledFeatures: { workspaces: true } }),
    true,
  );
});

test("explicit enabledFeatures object: missing key is disabled", () => {
  assert.equal(planHasCapability({ workspaces: true }, "Starter", "api_access"), false);
});

test("defaultEnabledFeaturesForPlanName matches legacy expectations", () => {
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Growth"), { workspaces: true, api_access: false });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Pro"), { workspaces: true, api_access: true });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Starter"), { workspaces: false, api_access: false });
});

test("workspacesUpgradeMessage lists plan names", () => {
  const msg = workspacesUpgradeMessage(["Pro", "Agencies"]);
  assert.match(msg, /Pro/);
  assert.match(msg, /Agencies/);
});

test("formatWorkspacesIncludedPlansLabel joins correctly", () => {
  assert.equal(formatWorkspacesIncludedPlansLabel(["Pro", "Agencies"]), "Pro and Agencies");
});

console.log("\nAll plan-capabilities tests passed.");
