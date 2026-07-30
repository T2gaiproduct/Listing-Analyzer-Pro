import type { jsPDF } from "jspdf";

type Rgb = [number, number, number];

const SELLERLENS_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" fill="none" role="img" aria-label="SellerLens">
  <g transform="translate(2 6)">
    <circle cx="14" cy="14" r="9" stroke="#f97316" stroke-width="3.5" fill="none"/>
    <path d="M10.5 10.5a5 5 0 0 1 6.2 1.2" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <line x1="20.5" y1="20.5" x2="27" y2="27" stroke="#f97316" stroke-width="3.5" stroke-linecap="round"/>
  </g>
  <text x="38" y="27" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#0f172a">Seller<tspan fill="#f97316">Lens</tspan></text>
</svg>`;

const LOGO_WORDMARK_ASPECT = 40 / 180;
const LOGO_WIDTH = 156;

const BRAND_ORANGE: Rgb = [249, 115, 22];
const BRAND_SLATE: Rgb = [15, 23, 42];

let cachedLogoDataUrl: string | null | undefined;

async function rasterizeSvgText(svgText: string, width = 720): Promise<string> {
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

export async function loadSellerLensLogoDataUrl(basePath?: string): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined && !basePath) return cachedLogoDataUrl;

  try {
    if (basePath) {
      const res = await fetch(`${basePath.replace(/\/$/, "")}/logo.svg`);
      if (res.ok) {
        const svgText = await res.text();
        const dataUrl = await rasterizeSvgText(svgText);
        if (!basePath) cachedLogoDataUrl = dataUrl;
        return dataUrl;
      }
    }
    const dataUrl = await rasterizeSvgText(SELLERLENS_LOGO_SVG);
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    if (!basePath) cachedLogoDataUrl = null;
    return null;
  }
}

/** @deprecated Use loadSellerLensLogoDataUrl */
export const loadTech2GlobeLogoDataUrl = loadSellerLensLogoDataUrl;

function drawWordmarkVector(doc: jsPDF, rightX: number, topY: number, width: number) {
  const scale = width / LOGO_WIDTH;
  const fontSize = 16 * scale;
  const x = rightX - width;
  const baselineY = topY + fontSize * 0.95;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...BRAND_SLATE);
  doc.text("Seller", x, baselineY);
  const sellerW = doc.getTextWidth("Seller");

  doc.setTextColor(...BRAND_ORANGE);
  doc.text("Lens", x + sellerW, baselineY);
}

export function drawSellerLensLogo(
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
}

/** @deprecated Use drawSellerLensLogo */
export const drawTech2GlobeLogo = drawSellerLensLogo;

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

  drawSellerLensLogo(doc, pageW - margin, 8, logoDataUrl, LOGO_WIDTH);

  const footerY = pageH - 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const footerText = sanitizePdfText(
    options?.footerNote
      ? `${options.footerNote} · Page ${page} of ${totalPages}`
      : `SellerLens · Page ${page} of ${totalPages}`,
  );
  doc.text(footerText, margin, footerY);
}

export function defaultLineHeight(fontSize: number, custom?: number): number {
  return custom ?? Math.ceil(fontSize * 1.5);
}

export const PDF_HEADER_RESERVE = 68;
export const PDF_FOOTER_RESERVE = 32;
