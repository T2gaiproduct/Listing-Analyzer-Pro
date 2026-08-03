import type PDFDocument from "pdfkit";
import { drawSellerLensLogo } from "./pdf-sellerlens-logo.js";

export interface ReceiptPdfInput {
  id: number;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  gatewayPaymentId: string | null;
  createdAt: string | Date;
  planName: string | null;
  billingCycle: string | null;
  customerName: string | null;
  companyName: string | null;
  email: string | null;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

const brand = "#f97316";
const slate900 = "#0f172a";
const slate600 = "#475569";
const slate400 = "#94a3b8";
const slate100 = "#f1f5f9";

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

/** Draw one line at exact coordinates; never rely on PDFKit text flow cursor. */
function line(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  opts: { font?: string; size?: number; color?: string },
): void {
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10);
  doc.fillColor(opts.color ?? slate900);
  doc.text(text, x, y, { lineBreak: false, continued: false });
}

/** Right-align a single line ending at rightX. */
function lineRight(
  doc: PdfDoc,
  text: string,
  rightX: number,
  y: number,
  opts: { font?: string; size?: number; color?: string },
): void {
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10);
  const w = doc.widthOfString(text);
  line(doc, text, rightX - w, y, opts);
}

/** Center a single line in [left, right]. */
function lineCenter(
  doc: PdfDoc,
  text: string,
  left: number,
  right: number,
  y: number,
  opts: { font?: string; size?: number; color?: string },
): void {
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10);
  const w = doc.widthOfString(text);
  const x = left + (right - left - w) / 2;
  line(doc, text, x, y, opts);
}

export function buildReceiptPdf(doc: PdfDoc, data: ReceiptPdfInput): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const m = 50;
  const right = pageWidth - m;
  const contentWidth = right - m;

  const labelX = m;
  const valueX = m + 132;
  const detailRowH = 20;
  const amountColRight = right;
  const amountColWidth = 88;
  const amountColLeft = amountColRight - amountColWidth;
  const qtyColCenter = amountColLeft - 28;
  const qtyColWidth = 36;
  const descMaxRight = qtyColCenter - qtyColWidth / 2 - 12;

  function sectionTitle(title: string, y: number): number {
    line(doc, title, labelX, y, { font: "Helvetica-Bold", size: 12, color: slate900 });
    const lineY = y + 16;
    doc.moveTo(m, lineY).lineTo(right, lineY).strokeColor(slate100).stroke();
    return lineY + 12;
  }

  function detailRow(label: string, value: string, y: number): number {
    line(doc, label, labelX, y, { color: slate600 });
    line(doc, value, valueX, y, { font: "Helvetica-Bold", color: slate900 });
    return y + detailRowH;
  }

  // ─── Header ───────────────────────────────────────────────────────────────
  const headerTop = m + 6;
  drawSellerLensLogo(doc, m + 4, headerTop, 34);
  lineRight(doc, "RECEIPT", right, headerTop + 6, { font: "Helvetica-Bold", size: 16, color: slate900 });
  lineRight(doc, "AI-powered Amazon listing optimization", right, headerTop + 26, { size: 10, color: slate400 });
  const headerBottom = headerTop + 48;
  doc.moveTo(m, headerBottom).lineTo(right, headerBottom).strokeColor(brand).lineWidth(2).stroke();

  // ─── Receipt details ─────────────────────────────────────────────────────
  let y = sectionTitle("Receipt Details", headerBottom + 20);
  y = detailRow("Receipt No:", `R-${String(data.id).padStart(6, "0")}`, y);
  y = detailRow(
    "Transaction ID:",
    data.gatewayPaymentId ?? `TXN-${String(data.id).padStart(6, "0")}`,
    y,
  );
  y = detailRow("Date:", formatDate(data.createdAt), y);
  y = detailRow("Payment Gateway:", data.gateway.charAt(0).toUpperCase() + data.gateway.slice(1), y);
  y = detailRow("Status:", data.status.charAt(0).toUpperCase() + data.status.slice(1), y);

  // ─── Bill to ─────────────────────────────────────────────────────────────
  y = sectionTitle("Bill To", y + 8);
  if (data.customerName) {
    line(doc, data.customerName, labelX, y, { font: "Helvetica-Bold", size: 11, color: slate900 });
    y += 16;
  }
  if (data.companyName) {
    line(doc, data.companyName, labelX, y, { color: slate600 });
    y += 16;
  }
  if (data.email) {
    line(doc, data.email, labelX, y, { color: slate400 });
    y += 16;
  }

  // ─── Items ───────────────────────────────────────────────────────────────
  y = sectionTitle("Items", y + 6);
  const tableHeaderY = y;
  line(doc, "Description", labelX, tableHeaderY, { font: "Helvetica-Bold", color: slate600 });
  lineCenter(doc, "Qty", qtyColCenter - qtyColWidth / 2, qtyColCenter + qtyColWidth / 2, tableHeaderY, {
    font: "Helvetica-Bold",
    color: slate600,
  });
  lineRight(doc, "Amount", amountColRight, tableHeaderY, { font: "Helvetica-Bold", color: slate600 });
  y += 12;
  doc.moveTo(m, y).lineTo(right, y).strokeColor(slate100).stroke();
  y += 10;

  const description = data.planName
    ? `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`
    : "Payment";
  const amountText = formatCurrency(data.amount, data.currency);

  doc.font("Helvetica").fontSize(10);
  const descHeight = doc.heightOfString(description, { width: descMaxRight - labelX, lineGap: 2 });
  doc.fillColor(slate900).text(description, labelX, y, {
    width: descMaxRight - labelX,
    lineGap: 2,
    continued: false,
  });
  lineCenter(doc, "1", qtyColCenter - qtyColWidth / 2, qtyColCenter + qtyColWidth / 2, y, { color: slate900 });
  lineRight(doc, amountText, amountColRight, y, { color: slate900 });
  y += Math.max(18, descHeight + 4);
  doc.moveTo(m, y).lineTo(right, y).strokeColor(slate100).stroke();
  y += 12;

  // ─── Totals ──────────────────────────────────────────────────────────────
  const totalsLabelRight = amountColLeft - 8;

  function totalRow(label: string, value: string, bold = false): void {
    const size = bold ? 12 : 10;
    const font = bold ? "Helvetica-Bold" : "Helvetica";
    lineRight(doc, label, totalsLabelRight, y, { font, size, color: slate600 });
    lineRight(doc, value, amountColRight, y, { font: "Helvetica-Bold", size, color: bold ? brand : slate900 });
    y += bold ? 18 : 16;
  }

  totalRow("Subtotal", amountText);
  totalRow("Tax", formatCurrency(0, data.currency));
  doc.moveTo(totalsLabelRight - 60, y - 2).lineTo(right, y - 2).strokeColor(slate100).stroke();
  y += 6;
  totalRow("TOTAL", amountText, true);

  // ─── Footer ──────────────────────────────────────────────────────────────
  const footerLineY = pageHeight - m - 48;
  doc.moveTo(m, footerLineY).lineTo(right, footerLineY).strokeColor(slate100).stroke();
  lineCenter(
    doc,
    "Thank you for your business. If you have questions, contact support@listingauditor.com.",
    m,
    right,
    footerLineY + 10,
    { size: 9, color: slate400 },
  );
  lineCenter(doc, "SellerLens · listingauditor.com", m, right, footerLineY + 22, { size: 9, color: slate400 });
}
