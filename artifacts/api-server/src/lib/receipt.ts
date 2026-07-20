import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { db, paymentsTable, plansTable, userProfilesTable } from "@workspace/db";

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
  // Fetch payment + plan + profile
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
    email: null, // filled by caller if available
  };

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const w = doc.page.width;
  const m = 50;

  // Brand color
  const brand = "#f97316"; // orange-500
  const slate900 = "#0f172a";
  const slate600 = "#475569";
  const slate400 = "#94a3b8";
  const slate100 = "#f1f5f9";

  // ─── Header band ───────────────────────────────────────────────────────────
  doc.rect(m, m, w - m * 2, 100).fill(brand);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(22).text("SellerLens", m + 24, m + 28);
  doc.font("Helvetica").fontSize(12).text("AI-powered Amazon listing optimization", m + 24, m + 58);
  doc.font("Helvetica-Bold").fontSize(16).text("RECEIPT", w - m - 120, m + 38, { align: "right" });

  // ─── Receipt details ───────────────────────────────────────────────────────
  let y = m + 130;
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(12).text("Receipt Details", m, y);
  doc.moveTo(m, y + 18).lineTo(w - m, y + 18).stroke(slate100);

  y += 28;
  const labelStyle = { width: 140, continued: true } as const;
  const detailStyle = { align: "left" } as const;

  function row(label: string, value: string) {
    doc.fillColor(slate600).font("Helvetica").fontSize(10).text(label, m, y, labelStyle);
    doc.fillColor(slate900).font("Helvetica-Bold").fontSize(10).text(value, m + 150, y, detailStyle);
    y += 18;
  }

  row("Receipt No:", `R-${String(data.id).padStart(6, "0")}`);
  row("Transaction ID:", data.gatewayPaymentId ? data.gatewayPaymentId : `TXN-${String(data.id).padStart(6, "0")}`);
  row("Date:", formatDate(data.createdAt));
  row("Payment Gateway:", data.gateway.charAt(0).toUpperCase() + data.gateway.slice(1));
  row("Status:", data.status.charAt(0).toUpperCase() + data.status.slice(1));

  // ─── Bill to ─────────────────────────────────────────────────────────────────
  y += 12;
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(12).text("Bill To", m, y);
  doc.moveTo(m, y + 18).lineTo(w - m, y + 18).stroke(slate100);
  y += 28;

  if (data.customerName) {
    doc.fillColor(slate900).font("Helvetica-Bold").fontSize(11).text(data.customerName, m, y);
    y += 16;
  }
  if (data.companyName) {
    doc.fillColor(slate600).font("Helvetica").fontSize(10).text(data.companyName, m, y);
    y += 16;
  }
  if (data.email) {
    doc.fillColor(slate400).font("Helvetica").fontSize(10).text(data.email, m, y);
    y += 16;
  }

  // ─── Line items table ────────────────────────────────────────────────────────
  y += 18;
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(12).text("Items", m, y);
  doc.moveTo(m, y + 18).lineTo(w - m, y + 18).stroke(slate100);
  y += 28;

  // Table header
  const colX = { desc: m, qty: m + 320, amount: w - m - 80 };
  doc.fillColor(slate600).font("Helvetica-Bold").fontSize(10)
    .text("Description", colX.desc, y)
    .text("Qty", colX.qty, y)
    .text("Amount", colX.amount, y, { width: 80, align: "right" });
  y += 20;
  doc.moveTo(m, y - 4).lineTo(w - m, y - 4).stroke(slate100);

  // Item row
  const description = data.planName
    ? `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`
    : "Payment";
  doc.fillColor(slate900).font("Helvetica").fontSize(10)
    .text(description, colX.desc, y, { width: 300 });
  doc.text("1", colX.qty, y);
  doc.text(formatCurrency(data.amount, data.currency), colX.amount, y, { width: 80, align: "right" });
  y += 28;
  doc.moveTo(m, y - 4).lineTo(w - m, y - 4).stroke(slate100);

  // ─── Totals ──────────────────────────────────────────────────────────────────
  y += 10;
  const totalCol = w - m - 140;
  doc.fillColor(slate600).font("Helvetica").fontSize(10).text("Subtotal", totalCol, y, { width: 80, align: "right" });
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(10).text(formatCurrency(data.amount, data.currency), w - m - 60, y, { width: 60, align: "right" });
  y += 18;
  doc.fillColor(slate600).font("Helvetica").fontSize(10).text("Tax", totalCol, y, { width: 80, align: "right" });
  doc.fillColor(slate900).font("Helvetica-Bold").fontSize(10).text(formatCurrency(0, data.currency), w - m - 60, y, { width: 60, align: "right" });
  y += 18;
  doc.moveTo(totalCol - 10, y - 2).lineTo(w - m, y - 2).stroke(slate100);
  y += 6;
  doc.fillColor(brand).font("Helvetica-Bold").fontSize(14).text("TOTAL", totalCol, y, { width: 80, align: "right" });
  doc.fillColor(brand).font("Helvetica-Bold").fontSize(14).text(formatCurrency(data.amount, data.currency), w - m - 80, y, { width: 80, align: "right" });
  y += 32;

  // ─── Footer ────────────────────────────────────────────────────────────────────
  doc.moveTo(m, w - m - 90).lineTo(w - m, w - m - 90).stroke(slate100);
  doc.fillColor(slate400).font("Helvetica").fontSize(9)
    .text("Thank you for your business. If you have questions, contact support@listingauditor.com.", m, w - m - 78, { width: w - m * 2, align: "center" });
  doc.text("SellerLens · listingauditor.com", m, w - m - 62, { width: w - m * 2, align: "center" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}
