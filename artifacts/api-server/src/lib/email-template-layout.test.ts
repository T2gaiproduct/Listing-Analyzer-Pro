import assert from "node:assert/strict";
import {
  authEmailCodeTemplate,
  inviteEmailTemplate,
  workspaceInviteEmailTemplate,
} from "./email-templates.js";
import { EMAIL_ACCENT_ORANGE } from "./email-template-layout.js";
import { buildOtpDigitBoxesHtml, escapeHtml } from "./email-template-layout.js";

function testEscapeHtml(): void {
  assert.equal(escapeHtml(`a<b>&"`), "a&lt;b&gt;&amp;&quot;");
}

function testOtpDigitBoxes(): void {
  const html = buildOtpDigitBoxesHtml("934578");
  assert.match(html, />9</);
  assert.match(html, />3</);
  assert.match(html, />8</);
  assert.equal((html.match(/border-radius:10px/g) ?? []).length, 6);
}

function testAuthEmailUsesOtpLayout(): void {
  const html = authEmailCodeTemplate({
    platformName: "Ecommerce Guru",
    code: "424242",
    expiresMinutes: 15,
  });
  assert.match(html, /Your one time password!/);
  assert.match(html, /logo\.png/);
  assert.match(html, />4</);
  assert.match(html, /alt="Ecommerce Guru"/);
  assert.match(html, /Ecommerce Guru<\/p>/);
}

function testInviteUsesModernLayout(): void {
  const html = inviteEmailTemplate({
    inviterName: "Alex",
    companyName: "Acme",
    inviteUrl: "https://example.com/invite",
    role: "editor",
    invitedName: "Sam",
  });
  assert.match(html, /Hey, welcome|invited to the team/i);
  assert.match(html, /logo\.png/);
  assert.match(html, /Get started|Accept invitation/i);
  assert.match(html, /alt="Ecommerce Guru"/);
  assert.doesNotMatch(html, /#db2777|#fdf2f8|#fbcfe8/);
  assert.match(html, new RegExp(EMAIL_ACCENT_ORANGE.replace("#", "\\#")));
}

function testWorkspaceInviteUsesOrangeTheme(): void {
  const html = workspaceInviteEmailTemplate({
    invitedName: "Amita",
    workspaceName: "My Workspace",
    roleName: "Admin",
    inviterName: "Alex",
    inviteUrl: "https://example.com/accept",
  });
  assert.match(html, /Join your workspace/);
  assert.match(html, new RegExp(`background:${EMAIL_ACCENT_ORANGE.replace("#", "\\#")}`));
  assert.doesNotMatch(html, /#db2777|#fdf2f8|#fbcfe8/);
}

testEscapeHtml();
testOtpDigitBoxes();
testAuthEmailUsesOtpLayout();
testInviteUsesModernLayout();
testWorkspaceInviteUsesOrangeTheme();
console.log("email-template-layout: ok");
