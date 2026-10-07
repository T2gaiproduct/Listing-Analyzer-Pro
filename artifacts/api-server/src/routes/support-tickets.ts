import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, formSubmissions } from "@workspace/db";
import { resolveSessionEmail } from "../lib/admin-auth.js";
import { notifyAdminUsers } from "../lib/notify-admins.js";
import { rateLimit } from "../lib/rate-limit.js";
import {
  SUPPORT_TICKET_REPLY_MAX_LENGTH,
  appendSupportTicketReply,
  isSupportTicketOwnedByEmail,
  lastSupportTicketActivityIso,
  parseSupportTicketData,
  serializePublicSupportTicket,
} from "../lib/support-ticket-data.js";
import { sendSupportTicketCustomerFollowUpEmail } from "../lib/support-ticket-email.js";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

async function sessionEmailForRequest(req: Request, userId: string): Promise<string | null> {
  const auth = getAuth(req);
  return resolveSessionEmail(userId, (auth?.sessionClaims ?? null) as Record<string, unknown> | null);
}

router.get("/support/tickets", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const email = await sessionEmailForRequest(req, userId);
  if (!email) {
    res.status(400).json({ error: "Could not determine your account email." });
    return;
  }

  const rows = await db
    .select()
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formType, "support"),
        sql`lower(${formSubmissions.email}) = ${email}`,
      ),
    )
    .orderBy(desc(formSubmissions.createdAt));

  const tickets = rows.map((row) => serializePublicSupportTicket(row));
  tickets.sort((a, b) => {
    const aAt = lastSupportTicketActivityIso(a);
    const bAt = lastSupportTicketActivityIso(b);
    return bAt.localeCompare(aAt);
  });

  res.json({ tickets });
});

router.post(
  "/support/tickets/:id/reply",
  requireAuth,
  rateLimit({ route: "support-ticket-reply", windowMs: 60 * 60 * 1000, max: 20 }),
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const email = await sessionEmailForRequest(req, userId);
    if (!email) {
      res.status(400).json({ error: "Could not determine your account email." });
      return;
    }

    const id = parseInt(String(req.params.id ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "Reply message is required" });
      return;
    }
    if (message.length > SUPPORT_TICKET_REPLY_MAX_LENGTH) {
      res.status(400).json({ error: "Reply is too long" });
      return;
    }

    const [ticket] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id)).limit(1);
    if (!ticket || !isSupportTicketOwnedByEmail(ticket, email)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const sentAt = new Date().toISOString();
    const data = appendSupportTicketReply(ticket.data, {
      from: "customer",
      message,
      sentAt,
    });

    const [updated] = await db
      .update(formSubmissions)
      .set({
        data,
        isRead: false,
      })
      .where(eq(formSubmissions.id, id))
      .returning();

    if (!updated) {
      res.status(500).json({ error: "Failed to save reply" });
      return;
    }

    const parsed = parseSupportTicketData(updated.data);
    void sendSupportTicketCustomerFollowUpEmail({
      ticketId: updated.id,
      customerEmail: updated.email ?? email,
      customerName: updated.name,
      subject: parsed.subject || "Support ticket",
      message,
    });

    void notifyAdminUsers({
      type: "support_ticket_reply",
      title: "Support ticket reply",
      message: `${updated.email ?? email}: ${parsed.subject || "Support ticket"}`,
      link: "/admin/help/support-tickets",
    });

    res.json({ ticket: serializePublicSupportTicket(updated) });
  },
);

export default router;
