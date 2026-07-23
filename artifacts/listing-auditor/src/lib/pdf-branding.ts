import type { jsPDF } from "jspdf";

type Rgb = [number, number, number];

const BRAND_RED: Rgb = [192, 0, 0];
const BRAND_BLACK: Rgb = [0, 0, 0];
const LOGO_TAGLINE = "you authorize, we improvise!!";

/** Total vertical space the logo block occupies (pt). */
export const PDF_LOGO_HEIGHT = 46;

/** Draw Tech2Globe logo with tagline — vector text for reliable PDF colors. */
export function drawTech2GlobeLogo(doc: jsPDF, rightX: number, topY: number, width = 168) {
  const scale = width / 168;
  const fontSize = 14.5 * scale;
  const x = rightX - width;
  const baselineY = topY + fontSize * 0.88;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  doc.setTextColor(...BRAND_RED);
  doc.text("Tech", x, baselineY);
  const techW = doc.getTextWidth("Tech");

  doc.setTextColor(...BRAND_BLACK);
  doc.text("2Globe", x + techW, baselineY);
  const textW = techW + doc.getTextWidth("2Globe");

  const lineY = baselineY + 2.6 * scale;
  doc.setDrawColor(...BRAND_BLACK);
  doc.setLineWidth(0.65 * scale);
  doc.line(x, lineY, x + textW, lineY);

  const globeCX = x + textW + 9 * scale;
  const globeCY = baselineY - fontSize * 0.28;
  const globeR = 10 * scale;

  doc.setFillColor(...BRAND_RED);
  doc.circle(globeCX, globeCY, globeR, "F");

  doc.setFillColor(255, 255, 255);
  doc.ellipse(globeCX - 2.8 * scale, globeCY - 1.2 * scale, 3.2 * scale, 4.8 * scale, "F");
  doc.ellipse(globeCX + 4.2 * scale, globeCY + 1.8 * scale, 3 * scale, 4.2 * scale, "F");
  doc.ellipse(globeCX - 1.2 * scale, globeCY + 5 * scale, 2.8 * scale, 2.4 * scale, "F");
  doc.ellipse(globeCX + 1.5 * scale, globeCY - 5.5 * scale, 2.2 * scale, 1.8 * scale, "F");

  const tagSize = 5.2 * scale;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(tagSize);
  doc.setTextColor(...BRAND_BLACK);
  doc.text(LOGO_TAGLINE, x, lineY + 7.5 * scale);
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

  drawTech2GlobeLogo(doc, pageW - margin, 10, 168);

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

export const PDF_HEADER_RESERVE = 58;
export const PDF_FOOTER_RESERVE = 32;
