import assert from "node:assert/strict";
import {
  authEmailCodeTemplate,
  inviteEmailTemplate,
} from "./email-templates.js";
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
}

testEscapeHtml();
testOtpDigitBoxes();
testAuthEmailUsesOtpLayout();
testInviteUsesModernLayout();
console.log("email-template-layout: ok");
