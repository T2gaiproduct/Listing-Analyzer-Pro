export type SupportTicketReplyFrom = "admin" | "customer";

export type SupportTicketReply = {
  from: SupportTicketReplyFrom;
  message: string;
  sentAt: string;
};

export type SupportTicketData = {
  subject?: string;
  message?: string;
  replies?: SupportTicketReply[];
  [key: string]: unknown;
};

export type PublicSupportTicket = {
  id: number;
  subject: string;
  message: string;
  name: string | null;
  createdAt: string;
  replies: SupportTicketReply[];
};

export function normalizeEmailKey(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeEmailKey(a);
  const right = normalizeEmailKey(b);
  return Boolean(left) && left === right;
}

export function isSupportTicketOwnedByEmail(
  ticket: { formType: string; email: string | null },
  email: string,
): boolean {
  return ticket.formType === "support" && emailsMatch(ticket.email, email);
}

export function normalizeSupportTicketReplies(raw: unknown): SupportTicketReply[] {
  if (!Array.isArray(raw)) return [];
  const out: SupportTicketReply[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const message = typeof rec.message === "string" ? rec.message.trim() : "";
    if (!message) continue;
    const sentAt = typeof rec.sentAt === "string" ? rec.sentAt : "";
    const from: SupportTicketReplyFrom = rec.from === "customer" ? "customer" : "admin";
    out.push({ from, message, sentAt });
  }
  return out;
}

export function parseSupportTicketData(data: unknown): {
  subject: string;
  message: string;
  replies: SupportTicketReply[];
} {
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    subject: typeof rec.subject === "string" ? rec.subject : "",
    message: typeof rec.message === "string" ? rec.message : "",
    replies: normalizeSupportTicketReplies(rec.replies),
  };
}

export function lastSupportTicketActivityIso(input: {
  createdAt: Date | string;
  replies: SupportTicketReply[];
}): string {
  const created =
    input.createdAt instanceof Date
      ? input.createdAt.toISOString()
      : String(input.createdAt);
  let latest = created;
  for (const reply of input.replies) {
    if (reply.sentAt && reply.sentAt > latest) latest = reply.sentAt;
  }
  return latest;
}

export function serializePublicSupportTicket(row: {
  id: number;
  name: string | null;
  data: unknown;
  createdAt: Date | string;
}): PublicSupportTicket {
  const parsed = parseSupportTicketData(row.data);
  return {
    id: row.id,
    subject: parsed.subject.trim() || "No subject",
    message: parsed.message,
    name: row.name,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    replies: parsed.replies,
  };
}

export function appendSupportTicketReply(
  data: unknown,
  reply: SupportTicketReply,
): SupportTicketData {
  const rec = (data && typeof data === "object" ? { ...(data as Record<string, unknown>) } : {}) as SupportTicketData;
  rec.replies = [...normalizeSupportTicketReplies(rec.replies), reply];
  return rec;
}

export const SUPPORT_TICKET_REPLY_MAX_LENGTH = 10_000;
