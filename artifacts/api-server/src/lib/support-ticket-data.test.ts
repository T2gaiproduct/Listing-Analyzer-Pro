import assert from "node:assert/strict";
import {
  appendSupportTicketReply,
  emailsMatch,
  isSupportTicketOwnedByEmail,
  lastSupportTicketActivityIso,
  normalizeSupportTicketReplies,
  serializePublicSupportTicket,
} from "./support-ticket-data.js";

function testOwnershipIsEmailAndSupportOnly(): void {
  assert.equal(
    isSupportTicketOwnedByEmail({ formType: "support", email: "User@Example.com" }, "user@example.com"),
    true,
  );
  assert.equal(
    isSupportTicketOwnedByEmail({ formType: "support", email: "other@example.com" }, "user@example.com"),
    false,
  );
  assert.equal(
    isSupportTicketOwnedByEmail({ formType: "contact", email: "user@example.com" }, "user@example.com"),
    false,
  );
  assert.equal(emailsMatch("  A@B.com ", "a@b.com"), true);
}

function testLegacyRepliesDefaultToAdmin(): void {
  const replies = normalizeSupportTicketReplies([
    { message: "Staff answer", sentAt: "2026-01-01T00:00:00.000Z" },
    { from: "customer", message: "Follow up", sentAt: "2026-01-02T00:00:00.000Z" },
    { from: "admin", message: "  ", sentAt: "2026-01-03T00:00:00.000Z" },
  ]);
  assert.equal(replies.length, 2);
  assert.equal(replies[0]?.from, "admin");
  assert.equal(replies[1]?.from, "customer");
}

function testSerializeAndAppend(): void {
  const ticket = serializePublicSupportTicket({
    id: 12,
    name: "Sahil",
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    data: { subject: "Lamp issue", message: "It is dim", replies: [{ message: "Checking" }] },
  });
  assert.equal(ticket.subject, "Lamp issue");
  assert.equal(ticket.replies[0]?.from, "admin");

  const next = appendSupportTicketReply(
    { subject: "Lamp issue", message: "It is dim", replies: [{ message: "Checking" }] },
    {
      from: "customer",
      message: "Still dim",
      sentAt: "2026-01-02T12:00:00.000Z",
    },
  );
  assert.equal(next.replies?.length, 2);
  assert.equal(next.replies?.[1]?.from, "customer");
  assert.equal(
    lastSupportTicketActivityIso({ createdAt: ticket.createdAt, replies: next.replies ?? [] }),
    "2026-01-02T12:00:00.000Z",
  );
}

testOwnershipIsEmailAndSupportOnly();
testLegacyRepliesDefaultToAdmin();
testSerializeAndAppend();
console.log("support-ticket-data: ok");
