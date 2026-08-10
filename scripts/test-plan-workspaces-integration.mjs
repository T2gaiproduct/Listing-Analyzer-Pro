import assert from "node:assert/strict";
import { listWorkspaceEntitledPlanNames } from "../artifacts/api-server/src/lib/plan-workspaces.ts";

const names = await listWorkspaceEntitledPlanNames();
console.log("Workspace-entitled plans:", names);
assert.ok(names.includes("Growth"), "Growth should have workspaces");
assert.ok(names.includes("Pro"), "Pro should have workspaces");
assert.ok(!names.includes("Starter"), "Starter should not have workspaces");
console.log("✓ listWorkspaceEntitledPlanNames integration test passed");
