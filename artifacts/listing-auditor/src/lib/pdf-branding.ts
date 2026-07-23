import type { jsPDF } from "jspdf";

type Rgb = [number, number, number];

const BRAND_RED: Rgb = [192, 0, 0];
const BRAND_GREY: Rgb = [51, 51, 51];

/** Draw Tech2Globe logo with vector text so colors are always correct in PDF. */
export function drawTech2GlobeLogo(doc: jsPDF, rightX: number, topY: number, width = 130) {
  const scale = width / 130;
  const fontSize = 16 * scale;
  const x = rightX - width;
  const baselineY = topY + fontSize * 0.9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  doc.setTextColor(...BRAND_RED);
  doc.text("Tech", x, baselineY);
  const techW = doc.getTextWidth("Tech");

  doc.setTextColor(...BRAND_GREY);
  doc.text("2Globe", x + techW, baselineY);
  const globeTextW = doc.getTextWidth("2Globe");
  const textW = techW + globeTextW;

  const lineY = baselineY + 2.8 * scale;
  doc.setDrawColor(...BRAND_GREY);
  doc.setLineWidth(0.7 * scale);
  doc.line(x, lineY, x + textW, lineY);

  const globeCX = x + textW + 11 * scale;
  const globeCY = baselineY - fontSize * 0.32;
  const globeR = 11.5 * scale;

  doc.setFillColor(...BRAND_RED);
  doc.circle(globeCX, globeCY, globeR, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(globeCX, globeCY, globeR * 0.88, "F");

  doc.setFillColor(...BRAND_RED);
  doc.ellipse(globeCX - 3.5 * scale, globeCY - 2.5 * scale, 4.2 * scale, 5.5 * scale, "F");
  doc.ellipse(globeCX + 4.5 * scale, globeCY + 1.5 * scale, 3.8 * scale, 4.5 * scale, "F");
  doc.ellipse(globeCX - 1 * scale, globeCY + 4.5 * scale, 3.2 * scale, 2.8 * scale, "F");
  doc.ellipse(globeCX + 1 * scale, globeCY - 5 * scale, 2.5 * scale, 2 * scale, "F");
}

/** @deprecated Logo is drawn natively; kept for API compatibility. */
export async function loadTech2GlobeLogoDataUrl(_basePath: string): Promise<string | null> {
  return null;
}

/** Strip characters that break jsPDF Helvetica metrics (wide spacing / overlap). */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2713|\u2714|\u2705/g, "-")
    .replace(/\u2022|\u25CF|\u25E6/g, "-")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

export function drawPdfPageChrome(
  doc: jsPDF,
  page: number,
  totalPages: number,
  _logoDataUrl?: string | null,
  options?: { margin?: number; footerNote?: string },
) {
  const margin = options?.margin ?? 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, pageW, 4, "F");

  drawTech2GlobeLogo(doc, pageW - margin, 12, 130);

  const footerY = pageH - 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const footerText = sanitizePdfText(
    options?.footerNote
      ? `${options.footerNote} · Page ${page} of ${totalPages}`
      : `Tech2Globe · SellerLens · Page ${page} of ${totalPages}`,
  );
  doc.text(footerText, margin, footerY);
}

export function defaultLineHeight(fontSize: number, custom?: number): number {
  return custom ?? Math.ceil(fontSize * 1.5);
}

export const PDF_HEADER_RESERVE = 52;
export const PDF_FOOTER_RESERVE = 32;
