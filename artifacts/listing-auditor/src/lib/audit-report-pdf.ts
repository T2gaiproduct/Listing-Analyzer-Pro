import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { AuditWithResults } from "@workspace/api-client-react";
import {
  defaultLineHeight,
  drawPdfPageChrome,
  loadTech2GlobeLogoDataUrl,
  PDF_FOOTER_RESERVE,
  PDF_HEADER_RESERVE,
  sanitizePdfText,
} from "@/lib/pdf-branding";

type Rgb = [number, number, number];

const MARGIN = 48;

function scoreColor(score: number): Rgb {
  if (score >= 70) return [22, 163, 74];
  if (score >= 50) return [202, 138, 4];
  return [220, 38, 38];
}

class AuditReportPdf {
  private readonly doc: jsPDF;
  private readonly contentW: number;
  private y = MARGIN + PDF_HEADER_RESERVE;

  constructor(private readonly logoDataUrl: string | null) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.contentW = this.doc.internal.pageSize.getWidth() - MARGIN * 2;
  }

  private pageHeight() {
    return this.doc.internal.pageSize.getHeight();
  }

  private contentBottom() {
    return this.pageHeight() - MARGIN - PDF_FOOTER_RESERVE;
  }

  private ensureSpace(needed: number) {
    if (this.y + needed > this.contentBottom()) {
      this.doc.addPage();
      this.y = MARGIN + 8;
    }
  }

  private setStyle(size: number, bold = false, color: Rgb = [30, 30, 30]) {
    this.doc.setFontSize(size);
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setTextColor(...color);
  }

  private addGap(px: number) {
    this.y += px;
  }

  private addRule(color: Rgb = [220, 220, 220], afterGap = 20) {
    this.ensureSpace(afterGap + 4);
    this.doc.setDrawColor(...color);
    this.doc.line(MARGIN, this.y, MARGIN + this.contentW, this.y);
    this.y += afterGap;
  }

  private addText(
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: Rgb;
      wrap?: boolean;
      lineH?: number;
      afterGap?: number;
      maxWidth?: number;
    } = {},
  ) {
    const safeText = sanitizePdfText(text);
    const size = options.size ?? 10;
    const lineH = defaultLineHeight(size, options.lineH);
    const maxWidth = options.maxWidth ?? this.contentW;
    this.setStyle(size, options.bold, options.color);

    if (options.wrap === false) {
      this.ensureSpace(lineH);
      this.doc.text(safeText, MARGIN, this.y);
      this.y += lineH;
    } else {
      const lines = this.doc.splitTextToSize(safeText, maxWidth) as string[];
      this.ensureSpace(lines.length * lineH + 2);
      lines.forEach((line) => {
        this.doc.text(line, MARGIN, this.y);
        this.y += lineH;
      });
    }

    if (options.afterGap) this.addGap(options.afterGap);
  }

  private addSectionTitle(title: string, topGap = 6) {
    this.y += topGap;
    this.addText(title, { size: 9, bold: true, color: [100, 116, 139], wrap: false, lineH: 11, afterGap: 0 });
    this.y += 6;
  }

  /** Large score below a section label — positions baseline using full glyph ascent. */
  private addOverallScoreBlock(score: number) {
    const labelSize = 9;
    const fontSize = 40;
    const ascender = fontSize * 0.78;
    const gapBelowLabel = 14;

    this.y += 4;
    this.ensureSpace(gapBelowLabel + ascender + fontSize * 0.3 + 12);
    this.setStyle(labelSize, true, [100, 116, 139]);
    this.doc.text("OVERALL SCORE", MARGIN, this.y);

    const scoreBaseline = this.y + gapBelowLabel + ascender;
    this.setStyle(fontSize, true, scoreColor(score));
    this.doc.text(String(score), MARGIN, scoreBaseline);
    this.y = scoreBaseline + fontSize * 0.28 + 12;
  }

  private addScoreRow(label: string, score: number) {
    const lineH = 16;
    this.ensureSpace(lineH);
    this.setStyle(10, false, [80, 80, 80]);
    this.doc.text(sanitizePdfText(label), MARGIN, this.y);
    this.setStyle(10, true, scoreColor(score));
    this.doc.text(String(score), MARGIN + 140, this.y);
    this.y += lineH;
  }

  private addBulletList(
    items: string[],
    label: string,
    labelColor: Rgb,
  ) {
    if (items.length === 0) return;
    this.addText(label, { size: 9, bold: true, color: labelColor, afterGap: 4 });
    items.forEach((item) => {
      this.addText(`- ${item}`, { size: 9, color: [71, 85, 105], lineH: 14 });
    });
    this.addGap(4);
  }

  build(audit: AuditWithResults) {
    const result = audit.result;

    this.addText("AMAZON LISTING AUDIT REPORT", {
      size: 8,
      bold: true,
      color: [255, 107, 0],
      wrap: false,
      afterGap: 8,
    });
    this.addText(audit.productName, {
      size: 17,
      bold: true,
      color: [15, 23, 42],
      lineH: 22,
      afterGap: 6,
    });
    if (audit.asin) {
      this.addText(`ASIN: ${audit.asin}`, { size: 9, color: [100, 116, 139], lineH: 12 });
    }
    this.addText(`Audited: ${format(new Date(audit.createdAt), "MMMM d, yyyy")}`, {
      size: 9,
      color: [100, 116, 139],
      lineH: 12,
      afterGap: 10,
    });
    this.addRule([255, 107, 0], 26);
    this.addOverallScoreBlock(audit.overallScore);
    this.addText(result.summary, { size: 10, color: [71, 85, 105], lineH: 15, afterGap: 10 });
    this.addRule();

    this.addSectionTitle("CATEGORY BREAKDOWN");
    this.addScoreRow("Title", result.titleScore.score);
    this.addScoreRow("Bullet Points", result.bulletScore.score);
    this.addScoreRow("Images", result.imageScore.score);
    this.addScoreRow("Keywords", result.keywordScore.score);
    this.addGap(8);
    this.addRule();

    this.addSectionTitle("LISTING TITLE");
    this.addText(audit.title, { size: 10, color: [30, 30, 30], lineH: 15 });
    this.addText(`${audit.title.length} characters`, {
      size: 8,
      color: [148, 163, 184],
      lineH: 12,
      afterGap: 8,
    });
    this.addRule();

    const sections = [
      { label: "TITLE ANALYSIS", data: result.titleScore },
      { label: "BULLET POINTS", data: result.bulletScore },
      { label: "IMAGES", data: result.imageScore },
      { label: "KEYWORDS", data: result.keywordScore },
    ];

    sections.forEach((section) => {
      this.addSectionTitle(section.label);
      this.addBulletList(section.data.issues, "Issues:", [220, 38, 38]);
      this.addBulletList(section.data.suggestions, "Suggestions:", [22, 163, 74]);
      this.addGap(6);
      this.addRule();
    });

    this.addSectionTitle("TARGET KEYWORDS");
    this.addText(audit.targetKeywords.join(", "), {
      size: 9,
      color: [71, 85, 105],
      lineH: 14,
      afterGap: 8,
    });
    this.addRule();

    if (audit.competitors.length > 0) {
      this.addSectionTitle("COMPETITOR COMPARISON");
      audit.competitors.forEach((competitor) => {
        this.addText(competitor.productName, {
          size: 10,
          bold: true,
          color: [15, 23, 42],
          lineH: 15,
        });
        this.addText(`Score: ${competitor.overallScore}`, {
          size: 9,
          color: [71, 85, 105],
          lineH: 14,
        });
        if (competitor.strengths.length) {
          this.addText(`Strengths: ${competitor.strengths.slice(0, 2).join("; ")}`, {
            size: 9,
            color: [22, 163, 74],
            lineH: 14,
          });
        }
        if (competitor.weaknesses.length) {
          this.addText(`Weaknesses: ${competitor.weaknesses.slice(0, 2).join("; ")}`, {
            size: 9,
            color: [220, 38, 38],
            lineH: 14,
          });
        }
        this.addGap(8);
      });
      this.addRule();
    }

    if (audit.generatedContent) {
      const gc = audit.generatedContent;
      this.addSectionTitle("AI-GENERATED CONTENT");
      this.addText("Optimized Title:", { size: 9, bold: true, color: [30, 30, 30], afterGap: 4 });
      this.addText(gc.title, { size: 9, color: [71, 85, 105], lineH: 14, afterGap: 8 });
      this.addText("Bullet Points:", { size: 9, bold: true, color: [30, 30, 30], afterGap: 4 });
      gc.bulletPoints.forEach((bullet, index) => {
        this.addText(`${index + 1}. ${bullet}`, { size: 9, color: [71, 85, 105], lineH: 14 });
      });
      this.addGap(6);
      this.addText("Backend Keywords:", { size: 9, bold: true, color: [30, 30, 30], afterGap: 4 });
      this.addText(gc.keywords.join(", "), { size: 9, color: [71, 85, 105], lineH: 14 });
    }

    const pages = this.doc.getNumberOfPages();
    const auditedOn = format(new Date(audit.createdAt), "MMMM d, yyyy");
    for (let page = 1; page <= pages; page += 1) {
      this.doc.setPage(page);
      drawPdfPageChrome(this.doc, page, pages, this.logoDataUrl, {
        margin: MARGIN,
        footerNote: `Tech2Globe · SellerLens · ${auditedOn}`,
      });
    }

    return this.doc;
  }
}

export async function downloadAuditReportPdf(audit: AuditWithResults, basePath: string) {
  const logoDataUrl = await loadTech2GlobeLogoDataUrl(basePath);
  const builder = new AuditReportPdf(logoDataUrl);
  const doc = builder.build(audit);
  const filename = `${audit.productName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_audit_report.pdf`;
  doc.save(filename);
}
