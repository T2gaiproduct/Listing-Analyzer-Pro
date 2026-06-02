import { Resend } from "resend";

export const emailFrom = process.env.EMAIL_FROM ?? "ListingAuditor <noreply@listingauditor.com>";

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const client = getResend();
  if (!client) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const result = await client.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });
    return { success: true, id: result.data?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
