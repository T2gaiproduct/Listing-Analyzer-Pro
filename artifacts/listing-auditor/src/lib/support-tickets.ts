import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const MY_SUPPORT_TICKETS_QUERY_KEY = ["my-support-tickets"] as const;

export type SupportTicketReplyFrom = "admin" | "customer";

export type SupportTicketReply = {
  from: SupportTicketReplyFrom;
  message: string;
  sentAt: string;
};

export type MySupportTicket = {
  id: number;
  subject: string;
  message: string;
  name: string | null;
  createdAt: string;
  replies: SupportTicketReply[];
};

export async function fetchMySupportTickets(): Promise<MySupportTicket[]> {
  const data = await fetchJson<{ tickets: MySupportTicket[] }>(`${basePath}/api/support/tickets`);
  return Array.isArray(data.tickets) ? data.tickets : [];
}

export async function replyToMySupportTicket(id: number, message: string): Promise<MySupportTicket> {
  const data = await fetchJson<{ ticket: MySupportTicket }>(`${basePath}/api/support/tickets/${id}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!data.ticket?.id) {
    throw new Error("Could not save your reply.");
  }
  return data.ticket;
}

export function lastReplyFrom(ticket: MySupportTicket): SupportTicketReplyFrom | null {
  const last = ticket.replies[ticket.replies.length - 1];
  return last?.from ?? null;
}
