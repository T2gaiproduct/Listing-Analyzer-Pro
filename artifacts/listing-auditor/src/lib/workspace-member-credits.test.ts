import assert from "node:assert/strict";
import {
  buildMemberCreditPatchBody,
  emptyMemberCreditEdit,
} from "./workspace-member-credits.js";

const baseline = { auditCredits: 10, aiCredits: 10, imageCredits: 3 };

const addOnlyImage = emptyMemberCreditEdit(baseline);
addOnlyImage.mode = "add";
addOnlyImage.touched.image = true;
addOnlyImage.imageCredits = "10";
const patchAdd = buildMemberCreditPatchBody(addOnlyImage);
assert.equal(patchAdd?.creditUpdateMode, "add");
assert.equal(patchAdd?.imageCredits, 10);
assert.equal(patchAdd?.auditCredits, undefined);
assert.equal(patchAdd?.aiCredits, undefined);

const setAll = emptyMemberCreditEdit(baseline);
setAll.mode = "set";
const patchSet = buildMemberCreditPatchBody(setAll);
assert.equal(patchSet?.creditUpdateMode, "set");
assert.equal(patchSet?.auditCredits, 10);
assert.equal(patchSet?.aiCredits, 10);
assert.equal(patchSet?.imageCredits, 3);

console.log("workspace-member-credits.test.ts: ok");