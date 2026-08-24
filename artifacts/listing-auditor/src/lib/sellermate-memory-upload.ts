export const MEMORY_FILE_ACCEPT =
  ".csv,.xlsx,.xls,.md,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.jfif,.bmp";

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
