import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";

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

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const orange: RGB = rgb(0.976, 0.451, 0.086);
const slate900: RGB = rgb(0.059, 0.09, 0.165);
const slate600: RGB = rgb(0.28, 0.33, 0.39);
const slate400: RGB = rgb(0.58, 0.64, 0.72);
const slate100: RGB = rgb(0.945, 0.961, 0.976);

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

function baselineFromTop(top: number, fontSize: number): number {
  return PAGE_H - top - fontSize;
}

export async function buildReceiptPdfBytes(data: ReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const contentRight = PAGE_W - margin;
  const labelX = margin;
  const valueX = margin + 150;
  const rowStep = 22;

  function drawText(
    text: string,
    x: number,
    top: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {},
  ): void {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    page.drawText(text, {
      x,
      y: baselineFromTop(top, size),
      size,
      font: f,
      color: opts.color ?? slate900,
    });
  }

  function drawTextRight(
    text: string,
    rightX: number,
    top: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {},
  ): void {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const w = f.widthOfTextAtSize(text, size);
    drawText(text, rightX - w, top, { ...opts, font: f, size });
  }

  function drawTextCenter(
    text: string,
    left: number,
    right: number,
    top: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {},
  ): void {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const w = f.widthOfTextAtSize(text, size);
    drawText(text, left + (right - left - w) / 2, top, { ...opts, font: f, size });
  }

  function hLine(top: number): void {
    const y = baselineFromTop(top, 0);
    page.drawLine({
      start: { x: margin, y },
      end: { x: contentRight, y },
      thickness: 1,
      color: slate100,
    });
  }

  function thickHLine(top: number): void {
    const y = baselineFromTop(top, 0);
    page.drawLine({
      start: { x: margin, y },
      end: { x: contentRight, y },
      thickness: 2,
      color: orange,
    });
  }

  function sectionTitle(title: string, top: number): number {
    drawText(title, labelX, top, { size: 12, font: fontBold });
    hLine(top + 16);
    return top + 28;
  }

  function detailRow(label: string, value: string, top: number): number {
    drawText(label, labelX, top, { size: 10, color: slate600 });
    drawText(value, valueX, top, { size: 10, font: fontBold });
    return top + rowStep;
  }

  // ─── Header ───────────────────────────────────────────────────────────────
  let top = 52;
  const brandSize = 20;
  const sellerW = fontBold.widthOfTextAtSize("Seller", brandSize);
  drawText("Seller", labelX, top, { size: brandSize, font: fontBold, color: slate900 });
  drawText("Lens", labelX + sellerW, top, { size: brandSize, font: fontBold, color: orange });
  drawTextRight("RECEIPT", contentRight, top, { size: 16, font: fontBold });
  drawTextRight("AI-powered Amazon listing optimization", contentRight, top + 20, { size: 10, color: slate400 });
  thickHLine(top + 46);

  // ─── Receipt details ────────────────────────────────────────────────────────
  top = sectionTitle("Receipt Details", top + 58);
  top = detailRow("Receipt No:", `R-${String(data.id).padStart(6, "0")}`, top);
  top = detailRow(
    "Transaction ID:",
    data.gatewayPaymentId ?? `TXN-${String(data.id).padStart(6, "0")}`,
    top,
  );
  top = detailRow("Date:", formatDate(data.createdAt), top);
  top = detailRow("Payment Gateway:", data.gateway.charAt(0).toUpperCase() + data.gateway.slice(1), top);
  top = detailRow("Status:", data.status.charAt(0).toUpperCase() + data.status.slice(1), top);

  // ─── Bill to ──────────────────────────────────────────────────────────────
  top = sectionTitle("Bill To", top + 8);
  if (data.customerName) {
    drawText(data.customerName, labelX, top, { size: 11, font: fontBold });
    top += 18;
  }
  if (data.companyName) {
    drawText(data.companyName, labelX, top, { size: 10, color: slate600 });
    top += 18;
  }
  if (data.email) {
    drawText(data.email, labelX, top, { size: 10, color: slate400 });
    top += 18;
  }

  // ─── Items ────────────────────────────────────────────────────────────────
  top = sectionTitle("Items", top + 6);
  const qtyRight = contentRight - 100;
  drawText("Description", labelX, top, { size: 10, font: fontBold, color: slate600 });
  drawTextRight("Qty", qtyRight, top, { size: 10, font: fontBold, color: slate600 });
  drawTextRight("Amount", contentRight, top, { size: 10, font: fontBold, color: slate600 });
  hLine(top + 14);
  top += 22;

  const description = data.planName
    ? `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`
    : "Payment";
  const amountText = formatCurrency(data.amount, data.currency);

  drawText(description, labelX, top, { size: 10 });
  drawTextRight("1", qtyRight, top, { size: 10 });
  drawTextRight(amountText, contentRight, top, { size: 10 });
  hLine(top + 16);
  top += 28;

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totalsLabelRight = contentRight - 110;

  function totalRow(label: string, value: string, bold = false): void {
    const size = bold ? 12 : 10;
    const labelFont = bold ? fontBold : font;
    drawTextRight(label, totalsLabelRight, top, { size, font: labelFont, color: slate600 });
    drawTextRight(value, contentRight, top, {
      size,
      font: fontBold,
      color: bold ? orange : slate900,
    });
    top += bold ? 20 : 18;
  }

  totalRow("Subtotal", amountText);
  totalRow("Tax", formatCurrency(0, data.currency));
  hLine(top - 2);
  top += 6;
  totalRow("TOTAL", amountText, true);

  // ─── Footer ───────────────────────────────────────────────────────────────
  const footerLineTop = PAGE_H - margin - 42;
  hLine(footerLineTop);
  drawTextCenter(
    "Thank you for your business. If you have questions, contact support@sellerlens.io.",
    margin,
    contentRight,
    footerLineTop + 14,
    { size: 9, color: slate400 },
  );
  drawTextCenter("Seller Lens · sellerlens.io", margin, contentRight, footerLineTop + 26, {
    size: 9,
    color: slate400,
  });

  return pdf.save();
}
