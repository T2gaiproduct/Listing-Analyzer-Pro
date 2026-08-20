export type AdsConsoleCsvExport = {
  filename: string;
  headers: string[];
  rows: string[][];
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAdsConsoleCsvExport(
  filename: string,
  headers: string[],
  rows: Array<Record<string, string | number | null | undefined>>,
  keys: string[],
): AdsConsoleCsvExport | null {
  if (!rows.length) return null;
  return {
    filename,
    headers,
    rows: rows.map((row) => keys.map((key) => String(row[key] ?? ""))),
  };
}

export function downloadAdsConsoleCsv(exportData: AdsConsoleCsvExport): void {
  const header = exportData.headers.map(escapeCsvCell).join(",");
  const body = exportData.rows
    .map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(","))
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${exportData.filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
