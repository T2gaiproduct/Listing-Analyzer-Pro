import type { jsPDF } from "jspdf";

const LOGO_FILE = "tech2globe-logo.svg";

function rasterizeImage(src: string, width = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth || 0.2;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.max(1, Math.round(width * aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }
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
    const logoW = 108;
    const logoH = 22;
    doc.addImage(logoDataUrl, "PNG", pageW - margin - logoW, margin - 6, logoW, logoH);
  }

  const footerY = pageH - 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const footerText = options?.footerNote
    ? `${options.footerNote} · Page ${page} of ${totalPages}`
    : `Tech2Globe · SellerLens · Page ${page} of ${totalPages}`;
  doc.text(footerText, margin, footerY);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", pageW - margin - 72, footerY - 14, 72, 15);
  }
}

export function defaultLineHeight(fontSize: number, custom?: number): number {
  return custom ?? Math.ceil(fontSize * 1.45);
}
