import PDFDocument from "pdfkit";

const BRAND = "#f97316";
const SLATE = "#0f172a";

type PdfDoc = InstanceType<typeof PDFDocument>;

/**
 * Draw SellerLens wordmark + magnifying-glass icon (matches public/logo.svg).
 */
export function drawSellerLensLogo(
  doc: PdfDoc,
  x: number,
  y: number,
  height = 34,
): number {
  const scale = height / 40;
  const iconOffsetX = 2 * scale;
  const iconOffsetY = 6 * scale;
  const cx = x + iconOffsetX + 14 * scale;
  const cy = y + iconOffsetY + 14 * scale;
  const r = 9 * scale;

  doc.save();
  doc.lineWidth(3.5 * scale).strokeColor(BRAND);
  doc.circle(cx, cy, r).stroke();
  doc.moveTo(cx - 3.5 * scale, cy - 3.5 * scale)
    .lineTo(cx + 2 * scale, cy - 1 * scale)
    .lineWidth(2.5 * scale)
    .stroke();
  doc.moveTo(cx + 6.5 * scale, cy + 6.5 * scale)
    .lineTo(cx + 13 * scale, cy + 13 * scale)
    .lineWidth(3.5 * scale)
    .stroke();

  const textX = x + 38 * scale;
  const textY = y + 26 * scale;
  const fontSize = 22 * scale;
  doc.font("Helvetica-Bold").fontSize(fontSize);
  doc.fillColor(SLATE).text("Seller", textX, textY, { continued: true, lineBreak: false });
  doc.fillColor(BRAND).text("Lens", { continued: false, lineBreak: false });
  doc.restore();

  return height;
}
