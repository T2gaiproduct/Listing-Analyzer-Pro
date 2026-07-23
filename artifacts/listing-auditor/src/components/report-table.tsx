import { useMemo, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import { drawPdfPageChrome, loadTech2GlobeLogoDataUrl, sanitizePdfText } from "@/lib/pdf-branding";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Download, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, ArrowUpDown, Search, Inbox,
} from "lucide-react";
import { ResponsiveTable } from "@/components/responsive-table";

export interface ReportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
}

interface ReportTableProps<T> {
  title: string;
  description?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  isLoading?: boolean;
  exportFilename: string;
  filters?: ReactNode;
  searchPlaceholder?: string;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportTable<T>({
  title, description, columns, rows, isLoading, exportFilename, filters, searchPlaceholder,
}: ReportTableProps<T>) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => String(c.value(r)).toLowerCase().includes(q)));
  }, [rows, columns, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = col.value(a); const vb = col.value(b);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => esc(c.header)).join(",");
    const body = sorted.map((r) => columns.map((c) => esc(c.value(r))).join(",")).join("\n");
    downloadBlob(`${header}\n${body}`, `${exportFilename}.csv`, "text/csv;charset=utf-8;");
  };

  const exportPdf = async () => {
    const logoDataUrl = await loadTech2GlobeLogoDataUrl(basePath);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const marginX = 48;
    let y = 56;
    doc.setFontSize(16);
    doc.text(sanitizePdfText(title), marginX, y);
    doc.setFontSize(9);
    y += 8;
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()} · ${sorted.length} rows`, marginX, y + 6);
    doc.setTextColor(0);
    y += 24;

    const pageWidth = doc.internal.pageSize.getWidth();
    const usable = pageWidth - marginX * 2;
    const colWidth = usable / columns.length;
    const rowHeight = 18;
    const pageHeight = doc.internal.pageSize.getHeight();

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      columns.forEach((c, i) => doc.text(String(c.header), marginX + i * colWidth + 2, y));
      doc.setDrawColor(200);
      doc.line(marginX, y + 4, marginX + usable, y + 4);
      doc.setFont("helvetica", "normal");
      y += rowHeight;
    };
    drawHeader();

    doc.setFontSize(8);
    sorted.forEach((r) => {
      if (y > pageHeight - 40) { doc.addPage(); y = 56; drawHeader(); doc.setFontSize(8); }
      columns.forEach((c, i) => {
        let text = sanitizePdfText(String(c.value(r) ?? ""));
        const maxChars = Math.floor(colWidth / 4.2);
        if (text.length > maxChars) text = text.slice(0, maxChars - 1) + "…";
        doc.text(text, marginX + i * colWidth + 2, y);
      });
      y += rowHeight;
    });

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      drawPdfPageChrome(doc, page, pages, logoDataUrl, {
        margin: marginX,
        footerNote: `Tech2Globe · ${title}`,
      });
    }

    doc.save(`${exportFilename}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title font-bold text-slate-900">{title}</h1>
        {description && <p className="text-slate-500 text-sm mt-1">{description}</p>}
      </div>

      {filters && <Card className="border-0 shadow-sm p-4">{filters}</Card>}

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Download className="w-4 h-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportCsv} className="gap-2"><FileSpreadsheet className="w-4 h-4 text-green-600" /> Export as Excel (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf} className="gap-2"><FileText className="w-4 h-4 text-red-600" /> Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              Show
              <select
                className="h-11 sm:h-8 rounded-md border border-slate-200 bg-white px-2 text-sm flex-1 sm:flex-none"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              entries
            </div>
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-11 sm:h-8 pl-8 w-full sm:w-56"
                placeholder={searchPlaceholder ?? "Search…"}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </div>
        </div>

        <ResponsiveTable>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    <ArrowUpDown className={`w-3 h-3 ${sortKey === c.key ? "text-orange-500" : "text-slate-300"}`} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {columns.map((c) => <td key={c.key} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                </tr>
              ))}
            {!isLoading && paged.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-slate-700 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.render ? c.render(r) : String(c.value(r) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No records found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </ResponsiveTable>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          <span>
            {sorted.length === 0 ? "0" : `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, sorted.length)}`} of {sorted.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="px-2 py-1">Page {currentPage + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
