/**
 * Generate sample receipt PDF for layout check.
 * Run: cd artifacts/api-server && pnpm exec tsx ../../scripts/src/test-receipt-pdf.ts
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReceiptPdf, type ReceiptPdfInput } from "../src/lib/receipt-pdf-layout.js";

const sample: ReceiptPdfInput = {
  id: 5,
  amount: 79,
  currency: "USD",
  status: "completed",
  gateway: "paypal",
  gatewayPaymentId: "03567627CW746091H",
  createdAt: new Date("2026-08-03"),
  planName: "Growth",
  billingCycle: "monthly",
  customerName: "Dcr",
  companyName: "sd",
  email: null,
};

const doc = new PDFDocument({ size: "A4", margin: 50 });
const out = path.join("/tmp", "receipt-test-000005.pdf");
const stream = fs.createWriteStream(out);
doc.pipe(stream);
buildReceiptPdf(doc, sample);
doc.end();
stream.on("finish", () => console.log("Written:", out));
