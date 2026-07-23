import type { jsPDF } from "jspdf";

const LOGO_FILE = "tech2globe-logo.svg";
const LOGO_ASPECT = 380 / 72;

function rasterizeImage(src: string, width = 760): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth || 1 / LOGO_ASPECT;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.max(1, Math.round(width * aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadTech2GlobeLogoDataUrl(basePath: string): Promise<string | null> {
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  try {
    return await rasterizeImage(`${normalizedBase}${LOGO_FILE}`);
  } catch {
    return null;
  }
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

  if (logoDataUrl) {
    const logoW = 118;
    const logoH = logoW / LOGO_ASPECT;
    doc.addImage(logoDataUrl, "PNG", pageW - margin - logoW, 14, logoW, logoH);
  }

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

export const PDF_HEADER_RESERVE = 40;
export const PDF_FOOTER_RESERVE = 32;
