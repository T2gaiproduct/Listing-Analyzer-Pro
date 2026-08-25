import ExcelJS from "exceljs";
import CSSMatrix from "@thednp/dommatrix";

let pdfGlobalsReady = false;

function ensurePdfParseGlobals(): void {
  if (pdfGlobalsReady) return;
  const g = globalThis as typeof globalThis & { DOMMatrix?: typeof CSSMatrix };
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = CSSMatrix;
  }
  pdfGlobalsReady = true;
}

export const MEMORY_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const MEMORY_FILE_MAX_TOKENS = 25_000;
export const MEMORY_FILE_MAX_ROWS = 50_000;
export const MEMORY_FILE_MAX_COLUMNS = 400;

export const MEMORY_FILE_EXTENSIONS = [
  ".csv",
  ".xlsx",
  ".xls",
  ".md",
  ".txt",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".jfif",
  ".bmp",
  ".heic",
  ".heif",
] as const;

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".bmp", ".heic", ".heif"]);

export function memoryFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function imageMimeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Infer extension when the filename omits one (common on Windows exports). */
export function sniffMemoryFileExtension(filename: string, buffer: Buffer): string {
  const fromName = memoryFileExtension(filename);
  if (fromName && MEMORY_FILE_EXTENSIONS.includes(fromName as (typeof MEMORY_FILE_EXTENSIONS)[number])) {
    return fromName;
  }

  if (buffer.length >= 4) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return ".pdf";
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return ".xlsx";
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return ".jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return ".png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return ".gif";
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) return ".bmp";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return ".webp";
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("utf8");
  if (sample.includes(",") && sample.includes("\n")) return ".csv";
  if (sample.trim()) return ".txt";

  return fromName;
}

export function allowedMemoryExtensionsLabel(): string {
  return "CSV, XLSX, XLS, MD, TXT, PDF, JPG, PNG, GIF, WEBP, HEIC, and other common image formats";
}

export function isAllowedMemoryFilename(filename: string): boolean {
  const ext = memoryFileExtension(filename);
  return MEMORY_FILE_EXTENSIONS.includes(ext as (typeof MEMORY_FILE_EXTENSIONS)[number]);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function assertTokenLimit(text: string): void {
  const tokens = estimateTokens(text);
  if (tokens > MEMORY_FILE_MAX_TOKENS) {
    throw new Error(`File is too large for memory (${tokens.toLocaleString()} tokens). Max is ${MEMORY_FILE_MAX_TOKENS.toLocaleString()} tokens.`);
  }
}

function assertSizeLimit(buffer: Buffer): void {
  if (buffer.length > MEMORY_FILE_MAX_BYTES) {
    throw new Error(`File exceeds ${MEMORY_FILE_MAX_BYTES / (1024 * 1024)} MB limit.`);
  }
}

function parseDelimitedText(text: string, ext: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length > MEMORY_FILE_MAX_ROWS) {
    throw new Error(`File has too many rows (${lines.length.toLocaleString()}). Max is ${MEMORY_FILE_MAX_ROWS.toLocaleString()} rows.`);
  }

  const delimiter = ext === ".csv" ? "," : null;
  if (delimiter) {
    const maxCols = lines.reduce((max, line) => {
      const cols = line.split(delimiter).length;
      return Math.max(max, cols);
    }, 0);
    if (maxCols > MEMORY_FILE_MAX_COLUMNS) {
      throw new Error(`File has too many columns (${maxCols}). Max is ${MEMORY_FILE_MAX_COLUMNS} columns.`);
    }
  }

  return text.trim();
}

async function parseExcelBuffer(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS typings expect Node Buffer; runtime accepts Uint8Array as well.
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);

  const chunks: string[] = [];
  let totalRows = 0;
  let maxCols = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    const rows: string[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      totalRows += 1;
      if (totalRows > MEMORY_FILE_MAX_ROWS) {
        throw new Error(`Spreadsheet exceeds ${MEMORY_FILE_MAX_ROWS.toLocaleString()} rows.`);
      }

      const values = (row.values as Array<string | number | boolean | Date | null | undefined>)
        .slice(1)
        .map((value) => {
          if (value == null) return "";
          if (value instanceof Date) return value.toISOString();
          return String(value).trim();
        });

      maxCols = Math.max(maxCols, values.length);
      if (maxCols > MEMORY_FILE_MAX_COLUMNS) {
        throw new Error(`Spreadsheet exceeds ${MEMORY_FILE_MAX_COLUMNS} columns.`);
      }

      if (values.some((value) => value.length > 0)) {
        rows.push(values.join("\t"));
      }
    });

    if (rows.length > 0) {
      chunks.push(`## Sheet: ${sheetName}\n${rows.join("\n")}`);
    }
  }

  const text = chunks.join("\n\n").trim();
  if (!text) throw new Error("Spreadsheet appears to be empty.");
  return text;
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  ensurePdfParseGlobals();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    if (!text) {
      throw new Error("Could not extract text from this PDF. Try a text-based PDF or save as TXT.");
    }
    return text;
  } finally {
    await parser.destroy();
  }
}

function parseImageBuffer(buffer: Buffer, filename: string, ext: string): string {
  const mime = imageMimeFromExtension(ext);
  const sizeLabel = `${(buffer.length / 1024).toFixed(1)} KB`;
  return [
    `Image memory: ${filename}`,
    `Format: ${mime}`,
    `Size: ${sizeLabel}`,
    "The seller attached this image for this agent. Treat it as visual/product context when answering questions about listings, infographics, or creative assets.",
  ].join("\n");
}

export async function extractMemoryFileText(input: {
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const { filename, buffer } = input;
  assertSizeLimit(buffer);

  const ext = sniffMemoryFileExtension(filename, buffer);
  if (!MEMORY_FILE_EXTENSIONS.includes(ext as (typeof MEMORY_FILE_EXTENSIONS)[number])) {
    throw new Error(`Unsupported file type. Allowed: ${allowedMemoryExtensionsLabel()}.`);
  }

  let text = "";
  if (IMAGE_EXTENSIONS.has(ext)) {
    text = parseImageBuffer(buffer, filename, ext);
  } else if (TEXT_EXTENSIONS.has(ext)) {
    text = parseDelimitedText(buffer.toString("utf8"), ext);
  } else if (EXCEL_EXTENSIONS.has(ext)) {
    text = await parseExcelBuffer(buffer);
  } else if (PDF_EXTENSIONS.has(ext)) {
    text = await parsePdfBuffer(buffer);
  }

  if (!text.trim()) {
    throw new Error("Could not extract any text from this file.");
  }

  assertTokenLimit(text);
  return text.trim();
}
