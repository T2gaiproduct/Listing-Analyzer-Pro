import type { jsPDF } from "jspdf";

type Rgb = [number, number, number];

const LOGO_TAGLINE = "you authorize, we improvise!!";
const LOGO_WORDMARK_ASPECT = 50 / 400;
const LOGO_WIDTH = 188;
const LOGO_TAGLINE_SIZE = 8;
const LOGO_TAGLINE_GAP = 5;

const BRAND_RED: Rgb = [192, 0, 0];
const BRAND_DARK_GRAY: Rgb = [61, 61, 61];
const BRAND_GLOBE_RED: Rgb = [160, 0, 0];

/** Inline SVG — avoids fetch/CORS failures when generating PDF client-side. */
const INLINE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 50" role="img" aria-label="Tech2Globe">
  <text x="0" y="34" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#C00000">Tech2</text>
  <text x="88" y="34" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#3D3D3D">Globe</text>
  <line x1="0" y1="42" x2="228" y2="42" stroke="#666666" stroke-width="1.8"/>
  <g transform="translate(262, 24)">
    <circle cx="0" cy="0" r="22" fill="#A00000"/>
    <clipPath id="g"><circle cx="0" cy="0" r="22"/></clipPath>
    <g clip-path="url(#g)" fill="#1A1A1A">
      <path d="M -8,-16 C -12,-6 -11,5 -7,13 C -5,17 -2,18 0,15 C 2,8 1,-3 -2,-11 C -4,-14 -6,-15 -8,-16 Z"/>
      <path d="M 2,-9 C 7,-12 13,-8 14,-1 C 15,5 12,12 8,15 C 4,17 2,13 3,6 C 4,0 3,-5 2,-9 Z"/>
      <path d="M -2,5 C 1,7 4,11 3,15 C 1,18 -3,17 -5,13 C -6,9 -4,5 -2,5 Z"/>
      <path d="M 9,-3 C 14,-5 17,1 15,7 C 13,12 9,14 9,9 C 8,4 8,0 9,-3 Z"/>
    </g>
  </g>
</svg>`;

let cachedLogoDataUrl: string | null | undefined;

async function rasterizeSvgText(svgText: string, width = 800): Promise<string> {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalHeight / img.naturalWidth || LOGO_WORDMARK_ASPECT;
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

export async function loadTech2GlobeLogoDataUrl(_basePath?: string): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    cachedLogoDataUrl = await rasterizeSvgText(INLINE_LOGO_SVG);
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

function drawTagline(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LOGO_TAGLINE_SIZE);
  doc.setTextColor(0, 0, 0);
  doc.text(LOGO_TAGLINE, x, y);
}

/** Vector fallback wordmark (no tagline — tagline drawn separately). */
function drawWordmarkVector(doc: jsPDF, rightX: number, topY: number, width: number) {
  const scale = width / LOGO_WIDTH;
  const fontSize = 14.5 * scale;
  const x = rightX - width;
  const baselineY = topY + fontSize * 0.9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...BRAND_RED);
  doc.text("Tech2", x, baselineY);
  const tech2W = doc.getTextWidth("Tech2");

  doc.setTextColor(...BRAND_DARK_GRAY);
  doc.text("Globe", x + tech2W, baselineY);
  const textW = tech2W + doc.getTextWidth("Globe");

  const lineY = baselineY + 2.8 * scale;
  doc.setDrawColor(102, 102, 102);
  doc.setLineWidth(0.65 * scale);
  doc.line(x, lineY, x + textW, lineY);

  const globeCX = x + textW + 9 * scale;
  const globeCY = baselineY - fontSize * 0.25;
  const globeR = 10 * scale;
  doc.setFillColor(...BRAND_GLOBE_RED);
  doc.circle(globeCX, globeCY, globeR, "F");
  doc.setFillColor(26, 26, 26);
  doc.ellipse(globeCX - 2.8 * scale, globeCY - 1 * scale, 3.2 * scale, 4.5 * scale, "F");
  doc.ellipse(globeCX + 3.8 * scale, globeCY + 1.8 * scale, 2.8 * scale, 4 * scale, "F");
  doc.ellipse(globeCX - 1 * scale, globeCY + 4.5 * scale, 2.5 * scale, 2.2 * scale, "F");
}

export function drawTech2GlobeLogo(
  doc: jsPDF,
  rightX: number,
  topY: number,
  logoDataUrl: string | null,
  width = LOGO_WIDTH,
) {
  const x = rightX - width;
  const wordmarkH = width * LOGO_WORDMARK_ASPECT;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", x, topY, width, wordmarkH);
  } else {
    drawWordmarkVector(doc, rightX, topY, width);
  }

  const taglineY = topY + wordmarkH + LOGO_TAGLINE_GAP + LOGO_TAGLINE_SIZE * 0.35;
  drawTagline(doc, x, taglineY);
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

  drawTech2GlobeLogo(doc, pageW - margin, 8, logoDataUrl, LOGO_WIDTH);

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

export const PDF_HEADER_RESERVE = 68;
export const PDF_FOOTER_RESERVE = 32;
