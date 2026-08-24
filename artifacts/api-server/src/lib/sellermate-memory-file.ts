import ExcelJS from "exceljs";

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
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".jfif",
  ".bmp",
] as const;

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);
const WORD_EXTENSIONS = new Set([".doc", ".docx"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".bmp"]);

export function memoryFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
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

function parseDelimitedText(text: string, filename: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length > MEMORY_FILE_MAX_ROWS) {
    throw new Error(`File has too many rows (${lines.length.toLocaleString()}). Max is ${MEMORY_FILE_MAX_ROWS.toLocaleString()} rows.`);
  }

  const delimiter = memoryFileExtension(filename) === ".csv" ? "," : null;
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
  await workbook.xlsx.load(buffer);

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

export async function extractMemoryFileText(input: {
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const { filename, buffer } = input;
  assertSizeLimit(buffer);

  const ext = memoryFileExtension(filename);
  if (!isAllowedMemoryFilename(filename)) {
    throw new Error(`Unsupported file type. Allowed: ${MEMORY_FILE_EXTENSIONS.join(", ")}`);
  }

  if (WORD_EXTENSIONS.has(ext)) {
    throw new Error("DOC and DOCX uploads are not supported yet. Save as TXT, MD, or CSV and try again.");
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Image files are not supported for agent memory yet. Use CSV, XLSX, MD, or TXT.");
  }

  let text = "";
  if (TEXT_EXTENSIONS.has(ext)) {
    text = parseDelimitedText(buffer.toString("utf8"), filename);
  } else if (EXCEL_EXTENSIONS.has(ext)) {
    text = await parseExcelBuffer(buffer);
  }

  if (!text.trim()) {
    throw new Error("Could not extract any text from this file.");
  }

  assertTokenLimit(text);
  return text.trim();
}
