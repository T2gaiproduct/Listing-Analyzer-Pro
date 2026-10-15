import PDFDocument from "pdfkit";

const BRAND = "#f97316";
const SLATE = "#0f172a";

type PdfDoc = InstanceType<typeof PDFDocument>;

/** Draw default wordmark when no custom logo image is available. */
export function drawSellerLensLogo(
  doc: PdfDoc,
  x: number,
  y: number,
  height = 34,
): number {
  const scale = height / 40;
  const textX = x + 2 * scale;
  const textY = y + 26 * scale;
  const fontSize = 22 * scale;
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const prefix = "Ecommerce ";
  const prefixW = doc.widthOfString(prefix);
  doc.fillColor(SLATE).text(prefix, textX, textY, { lineBreak: false, continued: false });
  doc.fillColor(BRAND).text("Guru", textX + prefixW, textY, { lineBreak: false, continued: false });

  return height;
}
