import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { db, paymentsTable, plansTable, userProfilesTable } from "@workspace/db";
import { drawSellerLensLogo } from "./pdf-sellerlens-logo.js";

interface ReceiptData {
  id: number;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  gatewayPaymentId: string | null;
  createdAt: string;
  planId: number | null;
  planName: string | null;
  billingCycle: string | null;
  customerName: string | null;
  companyName: string | null;
  email: string | null;
}

function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCurrency(amount: number, currency: string): string {
  const s = currency.toUpperCase();
  const symbol: Record<string, string> = {
    USD: "$", INR: "₹", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$",
  };
  return `${symbol[s] ?? s} ${amount.toFixed(2)}`;
}

/** Draw single-line text at fixed coordinates without affecting PDFKit's text flow cursor. */
function textAt(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: { width?: number; align?: "left" | "center" | "right"; font?: string; size?: number; color?: string },
): void {
  doc.save();
  doc.fillColor(opts.color ?? "#0f172a");
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10);
  doc.text(text, x, y, {
    width: opts.width,
    align: opts.align,
    lineBreak: false,
    continued: false,
  });
  doc.restore();
}

export async function buildReceipt(paymentId: number): Promise<Buffer> {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) throw new Error("Payment not found");

  let planName: string | null = null;
  let billingCycle: string | null = null;
  if (payment.planId) {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, payment.planId));
    if (plan) {
      planName = plan.name;
      billingCycle = (payment.metadata as Record<string, unknown>)?.billingCycle as string ?? "monthly";
    }
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, payment.userId));

  const data: ReceiptData = {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    gateway: payment.gateway,
    gatewayPaymentId: payment.gatewayPaymentId,
    createdAt: String(payment.createdAt),
    planId: payment.planId,
    planName,
    billingCycle,
    customerName: profile?.fullName ?? null,
    companyName: profile?.companyName ?? null,
    email: null,
  };

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const m = 50;
  const contentWidth = pageWidth - m * 2;

  const brand = "#f97316";
  const slate900 = "#0f172a";
  const slate600 = "#475569";
  const slate400 = "#94a3b8";
  const slate100 = "#f1f5f9";

  const labelColWidth = 120;
  const valueColX = m + labelColWidth + 16;
  const valueColWidth = contentWidth - labelColWidth - 16;
  const amountColWidth = 90;
  const amountColX = pageWidth - m - amountColWidth;
  const qtyColWidth = 40;
  const qtyColX = amountColX - qtyColWidth - 16;
  const descColWidth = qtyColX - m - 8;
  const rowGap = 18;

  function sectionTitle(title: string, y: number): number {
    textAt(doc, title, m, y, { font: "Helvetica-Bold", size: 12, color: slate900 });
    const lineY = y + 18;
    doc.moveTo(m, lineY).lineTo(pageWidth - m, lineY).strokeColor(slate100).stroke();
    return lineY + 14;
  }

  function detailRow(label: string, value: string, y: number): number {
    textAt(doc, label, m, y, { width: labelColWidth, color: slate600 });
    textAt(doc, value, valueColX, y, { width: valueColWidth, font: "Helvetica-Bold", color: slate900 });
    return y + rowGap;
  }

  // ─── Header ─────────────────────────────────────────────────────────────────
  const headerTop = m + 8;
  drawSellerLensLogo(doc, m + 8, headerTop, 36);
  textAt(doc, "RECEIPT", m, headerTop + 8, {
    width: contentWidth,
    align: "right",
    font: "Helvetica-Bold",
    size: 16,
    color: slate900,
  });
  textAt(doc, "AI-powered Amazon listing optimization", m, headerTop + 30, {
    width: contentWidth,
    align: "right",
    size: 11,
    color: slate400,
  });
  const headerBottom = headerTop + 52;
  doc.moveTo(m, headerBottom).lineTo(pageWidth - m, headerBottom).strokeColor(brand).lineWidth(2).stroke();

  // ─── Receipt details ────────────────────────────────────────────────────────
  let y = sectionTitle("Receipt Details", headerBottom + 24);
  y = detailRow("Receipt No:", `R-${String(data.id).padStart(6, "0")}`, y);
  y = detailRow(
    "Transaction ID:",
    data.gatewayPaymentId ? data.gatewayPaymentId : `TXN-${String(data.id).padStart(6, "0")}`,
    y,
  );
  y = detailRow("Date:", formatDate(data.createdAt), y);
  y = detailRow("Payment Gateway:", data.gateway.charAt(0).toUpperCase() + data.gateway.slice(1), y);
  y = detailRow("Status:", data.status.charAt(0).toUpperCase() + data.status.slice(1), y);

  // ─── Bill to ────────────────────────────────────────────────────────────────
  y = sectionTitle("Bill To", y + 10);
  if (data.customerName) {
    textAt(doc, data.customerName, m, y, { font: "Helvetica-Bold", size: 11, color: slate900 });
    y += 16;
  }
  if (data.companyName) {
    textAt(doc, data.companyName, m, y, { size: 10, color: slate600 });
    y += 16;
  }
  if (data.email) {
    textAt(doc, data.email, m, y, { size: 10, color: slate400 });
    y += 16;
  }

  // ─── Items table ────────────────────────────────────────────────────────────
  y = sectionTitle("Items", y + 8);

  textAt(doc, "Description", m, y, { width: descColWidth, font: "Helvetica-Bold", color: slate600 });
  textAt(doc, "Qty", qtyColX, y, { width: qtyColWidth, align: "center", font: "Helvetica-Bold", color: slate600 });
  textAt(doc, "Amount", amountColX, y, { width: amountColWidth, align: "right", font: "Helvetica-Bold", color: slate600 });
  y += 14;
  doc.moveTo(m, y).lineTo(pageWidth - m, y).strokeColor(slate100).stroke();
  y += 10;

  const description = data.planName
    ? `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`
    : "Payment";
  const amountText = formatCurrency(data.amount, data.currency);

  doc.save();
  doc.fillColor(slate900).font("Helvetica").fontSize(10);
  const descBottom = doc.heightOfString(description, { width: descColWidth });
  doc.text(description, m, y, { width: descColWidth, lineGap: 2 });
  doc.restore();
  textAt(doc, "1", qtyColX, y, { width: qtyColWidth, align: "center", color: slate900 });
  textAt(doc, amountText, amountColX, y, { width: amountColWidth, align: "right", color: slate900 });
  y += Math.max(18, descBottom + 4);
  doc.moveTo(m, y).lineTo(pageWidth - m, y).strokeColor(slate100).stroke();
  y += 14;

  // ─── Totals ─────────────────────────────────────────────────────────────────
  const totalsLabelX = amountColX - 100;
  const totalsLabelWidth = 100;

  function totalRow(label: string, value: string, bold = false): void {
    const size = bold ? 12 : 10;
    textAt(doc, label, totalsLabelX, y, {
      width: totalsLabelWidth,
      align: "right",
      font: bold ? "Helvetica-Bold" : "Helvetica",
      size,
      color: slate600,
    });
    textAt(doc, value, amountColX, y, {
      width: amountColWidth,
      align: "right",
      font: "Helvetica-Bold",
      size,
      color: bold ? brand : slate900,
    });
    y += bold ? 20 : 16;
  }

  totalRow("Subtotal", amountText);
  totalRow("Tax", formatCurrency(0, data.currency));
  doc.moveTo(totalsLabelX, y - 4).lineTo(pageWidth - m, y - 4).strokeColor(slate100).stroke();
  y += 4;
  totalRow("TOTAL", amountText, true);

  // ─── Footer ─────────────────────────────────────────────────────────────────
  const footerLineY = pageHeight - m - 52;
  const footerTextY = footerLineY + 10;
  doc.moveTo(m, footerLineY).lineTo(pageWidth - m, footerLineY).strokeColor(slate100).stroke();
  textAt(
    doc,
    "Thank you for your business. If you have questions, contact support@listingauditor.com.",
    m,
    footerTextY,
    { width: contentWidth, align: "center", size: 9, color: slate400 },
  );
  textAt(doc, "SellerLens · listingauditor.com", m, footerTextY + 14, {
    width: contentWidth,
    align: "center",
    size: 9,
    color: slate400,
  });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}
