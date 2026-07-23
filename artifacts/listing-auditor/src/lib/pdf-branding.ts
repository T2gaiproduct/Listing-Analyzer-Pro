import type { jsPDF } from "jspdf";

type Rgb = [number, number, number];

const LOGO_FILE = "tech2globe-logo.svg";
const LOGO_ASPECT = 82 / 440;

const BRAND_RED: Rgb = [192, 0, 0];
const BRAND_BLACK: Rgb = [0, 0, 0];
const LOGO_TAGLINE = "you authorize, we improvise!!";

let cachedLogoDataUrl: string | null | undefined;

async function rasterizeSvgText(svgText: string, width = 880): Promise<string> {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalHeight / img.naturalWidth || LOGO_ASPECT;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(width * aspect));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not create canvas context"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to rasterize SVG logo"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadTech2GlobeLogoDataUrl(basePath: string): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;

  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  try {
    const response = await fetch(`${normalizedBase}${LOGO_FILE}`);
    if (!response.ok) throw new Error(`Logo fetch failed (${response.status})`);
    const svgText = await response.text();
    cachedLogoDataUrl = await rasterizeSvgText(svgText);
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

/** Vector fallback when SVG image cannot be loaded. */
export function drawTech2GlobeLogoVector(doc: jsPDF, rightX: number, topY: number, width = 185) {
  const scale = width / 185;
  const fontSize = 15 * scale;
  const x = rightX - width;
  const baselineY = topY + fontSize * 0.9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...BRAND_RED);
  doc.text("Tech", x, baselineY);
  const techW = doc.getTextWidth("Tech");

  doc.setTextColor(...BRAND_BLACK);
  doc.text("2Globe", x + techW, baselineY);
  const textW = techW + doc.getTextWidth("2Globe");

  const lineY = baselineY + 3 * scale;
  doc.setDrawColor(...BRAND_BLACK);
  doc.setLineWidth(0.7 * scale);
  doc.line(x, lineY, x + textW, lineY);

  const globeCX = x + textW + 10 * scale;
  const globeCY = baselineY - fontSize * 0.25;
  const globeR = 11 * scale;
  doc.setFillColor(...BRAND_RED);
  doc.circle(globeCX, globeCY, globeR, "F");
  doc.setFillColor(255, 255, 255);
  doc.ellipse(globeCX - 3 * scale, globeCY - 1 * scale, 3.5 * scale, 5 * scale, "F");
  doc.ellipse(globeCX + 4 * scale, globeCY + 2 * scale, 3 * scale, 4.5 * scale, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * scale);
  doc.setTextColor(...BRAND_BLACK);
  doc.text(LOGO_TAGLINE, x, lineY + 10 * scale);
}

export function drawTech2GlobeLogo(
  doc: jsPDF,
  rightX: number,
  topY: number,
  logoDataUrl: string | null,
  width = 185,
) {
  if (logoDataUrl) {
    const logoH = width * LOGO_ASPECT;
    doc.addImage(logoDataUrl, "PNG", rightX - width, topY, width, logoH);
    return;
  }
  drawTech2GlobeLogoVector(doc, rightX, topY, width);
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
  logoDataUrl: string | null,
  options?: { margin?: number; footerNote?: string },
) {
  const margin = options?.margin ?? 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, pageW, 4, "F");

  drawTech2GlobeLogo(doc, pageW - margin, 8, logoDataUrl, 185);

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

export const PDF_HEADER_RESERVE = 62;
export const PDF_FOOTER_RESERVE = 32;
