export const MEMORY_FILE_ACCEPT =
  ".csv,.xlsx,.xls,.md,.txt,.pdf,.jpg,.jpeg,.png,.gif,.webp,.jfif,.bmp,.heic,.heif";

const ALLOWED_EXTENSIONS = MEMORY_FILE_ACCEPT.split(",").map((ext) => ext.trim().toLowerCase());

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".bmp", ".heic", ".heif"];

const UNSUPPORTED_EXTENSIONS = new Set([".doc", ".docx"]);

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function isAllowedMimeType(mime: string): boolean {
  const type = mime.toLowerCase();
  if (!type) return false;
  if (type.startsWith("image/")) return true;
  if (type === "application/pdf") return true;
  if (type.startsWith("text/")) return true;
  if (
    type.includes("spreadsheet")
    || type.includes("excel")
    || type.includes("csv")
    || type === "application/vnd.ms-excel"
    || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  return false;
}

export function memoryUploadValidationError(file: Pick<File, "name" | "type" | "size">): string | null {
  const ext = fileExtension(file.name);

  if (UNSUPPORTED_EXTENSIONS.has(ext)) {
    return "Word documents (.doc/.docx) are not supported yet. Save as PDF, TXT, MD, or CSV and try again.";
  }

  if (ALLOWED_EXTENSIONS.includes(ext) || isAllowedMimeType(file.type)) {
    return null;
  }

  // Extensionless uploads (common on drag-and-drop) — backend sniffs file magic bytes.
  if (!ext) {
    return null;
  }

  return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
}

export function isAllowedMemoryUploadFile(file: Pick<File, "name" | "type">): boolean {
  return memoryUploadValidationError(file) === null;
}

export function isImageMemoryFile(file: Pick<File, "name" | "type">): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.includes(fileExtension(file.name));
}

export function titleFromMemoryFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").trim() || filename;
}

export async function memoryFileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const MEMORY_UPLOAD_HELP_TEXT =
  "CSV, XLSX, XLS, MD, TXT, PDF, and images (JPG, PNG, WEBP, HEIC) — max 10 MB";
