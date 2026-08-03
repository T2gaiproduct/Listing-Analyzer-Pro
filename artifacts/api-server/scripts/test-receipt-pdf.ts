/**
 * Generate sample receipt PDF for layout check.
 * Run: cd artifacts/api-server && pnpm exec tsx scripts/test-receipt-pdf.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildReceiptPdfBytes, type ReceiptPdfInput } from "../src/lib/receipt-pdf-layout.js";

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

const out = path.join("/tmp", "receipt-test-000005.pdf");
const bytes = await buildReceiptPdfBytes(sample);
fs.writeFileSync(out, bytes);
console.log("Written:", out, bytes.length, "bytes");
