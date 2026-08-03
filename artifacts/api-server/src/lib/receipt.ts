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

  const labelColWidth = 130;
  const valueColX = m + labelColWidth + 12;
  const valueColWidth = contentWidth - labelColWidth - 12;
  const amountColWidth = 90;
  const amountColX = pageWidth - m - amountColWidth;
  const qtyColWidth = 40;
  const qtyColX = amountColX - qtyColWidth - 16;
  const descColWidth = qtyColX - m - 8;

  function sectionTitle(title: string, y: number): number {
    doc.fillColor(slate900).font("Helvetica-Bold").fontSize(12).text(title, m, y);
    const lineY = y + 18;
    doc.moveTo(m, lineY).lineTo(pageWidth - m, lineY).strokeColor(slate100).stroke();
    return lineY + 14;
  }

  function detailRow(label: string, value: string, y: number): number {
    const rowHeight = 16;
    doc.fillColor(slate600).font("Helvetica").fontSize(10).text(label, m, y, {
      width: labelColWidth,
      lineBreak: false,
    });
    doc.fillColor(slate900).font("Helvetica-Bold").fontSize(10).text(value, valueColX, y, {
      width: valueColWidth,
      lineBreak: false,
    });
    return y + rowHeight;
  }

  // ─── Header ─────────────────────────────────────────────────────────────────
  const headerTop = m + 8;
  drawSellerLensLogo(doc, m + 8, headerTop, 36);
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(16).text("RECEIPT", m, headerTop + 8, {
    width: contentWidth,
    align: "right",
    lineBreak: false,
  });
  doc.fillColor(slate400).font("Helvetica").fontSize(11).text(
    "AI-powered Amazon listing optimization",
    m,
    headerTop + 30,
    { width: contentWidth, align: "right", lineBreak: false },
  );
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
    doc.fillColor(slate900).font("Helvetica-Bold").fontSize(11).text(data.customerName, m, y, { lineBreak: false });
    y += 16;
  }
  if (data.companyName) {
    doc.fillColor(slate600).font("Helvetica").fontSize(10).text(data.companyName, m, y, { lineBreak: false });
    y += 16;
  }
  if (data.email) {
    doc.fillColor(slate400).font("Helvetica").fontSize(10).text(data.email, m, y, { lineBreak: false });
    y += 16;
  }

  // ─── Items table ────────────────────────────────────────────────────────────
  y = sectionTitle("Items", y + 8);

  doc.fillColor(slate600).font("Helvetica-Bold").fontSize(10);
  doc.text("Description", m, y, { width: descColWidth, lineBreak: false });
  doc.text("Qty", qtyColX, y, { width: qtyColWidth, align: "center", lineBreak: false });
  doc.text("Amount", amountColX, y, { width: amountColWidth, align: "right", lineBreak: false });
  y += 14;
  doc.moveTo(m, y).lineTo(pageWidth - m, y).strokeColor(slate100).stroke();
  y += 10;

  const description = data.planName
    ? `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`
    : "Payment";
  const amountText = formatCurrency(data.amount, data.currency);

  doc.fillColor(slate900).font("Helvetica").fontSize(10);
  doc.text(description, m, y, { width: descColWidth });
  const itemRowBottom = doc.y;
  doc.text("1", qtyColX, y, { width: qtyColWidth, align: "center", lineBreak: false });
  doc.text(amountText, amountColX, y, { width: amountColWidth, align: "right", lineBreak: false });
  y = Math.max(itemRowBottom, y + 14) + 8;
  doc.moveTo(m, y).lineTo(pageWidth - m, y).strokeColor(slate100).stroke();
  y += 14;

  // ─── Totals (aligned to amount column) ───────────────────────────────────────
  const totalsLabelX = amountColX - 100;
  const totalsLabelWidth = 100;

  function totalRow(label: string, value: string, bold = false): void {
    doc.fillColor(slate600).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10);
    doc.text(label, totalsLabelX, y, { width: totalsLabelWidth, align: "right", lineBreak: false });
    doc.fillColor(bold ? brand : slate900).font("Helvetica-Bold").fontSize(bold ? 12 : 10);
    doc.text(value, amountColX, y, { width: amountColWidth, align: "right", lineBreak: false });
    y += bold ? 20 : 16;
  }

  totalRow("Subtotal", amountText);
  totalRow("Tax", formatCurrency(0, data.currency));
  doc.moveTo(totalsLabelX, y - 4).lineTo(pageWidth - m, y - 4).strokeColor(slate100).stroke();
  y += 4;
  totalRow("TOTAL", amountText, true);

  // ─── Footer (fixed to bottom of page) ───────────────────────────────────────
  const footerLineY = pageHeight - m - 52;
  const footerTextY = footerLineY + 10;
  doc.moveTo(m, footerLineY).lineTo(pageWidth - m, footerLineY).strokeColor(slate100).stroke();
  doc.fillColor(slate400).font("Helvetica").fontSize(9);
  doc.text(
    "Thank you for your business. If you have questions, contact support@listingauditor.com.",
    m,
    footerTextY,
    { width: contentWidth, align: "center", lineBreak: false },
  );
  doc.text("SellerLens · listingauditor.com", m, footerTextY + 14, {
    width: contentWidth,
    align: "center",
    lineBreak: false,
  });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}
