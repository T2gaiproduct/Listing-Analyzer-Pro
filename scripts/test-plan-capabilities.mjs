import assert from "node:assert/strict";
import {
  planHasCapability,
  planIncludesWorkspacesFromPlan,
  defaultEnabledFeaturesForPlanName,
  workspacesUpgradeMessage,
  workspacesUpgradeMessageForCurrentPlan,
  workspacesUpgradeShortForCurrentPlan,
  adminCanEnableCapability,
  sanitizeEnabledFeaturesForPlan,
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

test("legacy fallback: Growth has no workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Growth" }), false);
});

test("legacy fallback: Starter has no workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Starter" }), false);
});

test("legacy fallback: Free has no workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Free" }), false);
});

test("legacy fallback: Agencies has workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Agencies" }), true);
});

test("legacy fallback: Pro has workspaces when enabledFeatures unset", () => {
  assert.equal(planIncludesWorkspacesFromPlan({ planName: "Pro" }), true);
});

test("admin config: explicit false on Pro disables workspaces", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Pro", enabledFeatures: { workspaces: false } }),
    false,
  );
});

test("admin config: explicit true on Starter enables workspaces", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Starter", enabledFeatures: { workspaces: true } }),
    true,
  );
});

test("admin config: explicit true on Free enables workspaces", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Free", enabledFeatures: { workspaces: true } }),
    true,
  );
});

test("explicit enabledFeatures object: missing key is disabled", () => {
  assert.equal(planHasCapability({ workspaces: true }, "Pro", "api_access"), false);
  assert.equal(planHasCapability({ api_access: true }, "Pro", "workspaces"), false);
});

test("admin config: explicit false on Pro disables workspaces even with legacy name", () => {
  assert.equal(
    planIncludesWorkspacesFromPlan({ planName: "Pro", enabledFeatures: { workspaces: false, api_access: true } }),
    false,
  );
});

test("defaultEnabledFeaturesForPlanName matches expectations", () => {
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Growth"), { workspaces: false, api_access: false });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Pro"), { workspaces: true, api_access: true });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Agencies"), { workspaces: true, api_access: true });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Starter"), { workspaces: false, api_access: false });
  assert.deepEqual(defaultEnabledFeaturesForPlanName("Free"), { workspaces: false, api_access: false });
});

test("adminCanEnableCapability allows workspaces on any plan", () => {
  assert.equal(adminCanEnableCapability("Starter", "workspaces"), true);
  assert.equal(adminCanEnableCapability("Pro", "workspaces"), true);
});

test("sanitizeEnabledFeaturesForPlan preserves admin toggles on Free", () => {
  assert.deepEqual(
    sanitizeEnabledFeaturesForPlan("Free", { workspaces: true, api_access: false }),
    { workspaces: true, api_access: false },
  );
});

test("workspacesUpgradeMessage lists plan names", () => {
  const msg = workspacesUpgradeMessage(["Pro", "Agencies"]);
  assert.match(msg, /Pro/);
  assert.match(msg, /Agencies/);
});

test("workspacesUpgradeMessageForCurrentPlan mentions current plan", () => {
  const msg = workspacesUpgradeMessageForCurrentPlan("Starter", ["Pro", "Agencies"]);
  assert.match(msg, /Starter/);
  assert.match(msg, /Pro/);
});

test("workspacesUpgradeShortForCurrentPlan mentions current plan", () => {
  const msg = workspacesUpgradeShortForCurrentPlan("Free", ["Pro", "Agencies"]);
  assert.match(msg, /Free/);
});

test("formatWorkspacesIncludedPlansLabel joins correctly", () => {
  assert.equal(formatWorkspacesIncludedPlansLabel(["Pro", "Agencies"]), "Pro and Agencies");
});

console.log("\nAll plan-capabilities tests passed.");
