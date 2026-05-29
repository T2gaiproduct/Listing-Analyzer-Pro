import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export const emailFrom = process.env.EMAIL_FROM ?? "ListingAuditor <noreply@listingauditor.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const result = await resend.emails.send({
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
