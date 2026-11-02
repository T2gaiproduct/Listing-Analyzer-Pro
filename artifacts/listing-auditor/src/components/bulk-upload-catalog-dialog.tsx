import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  FolderTree,
  Layers,
  Loader2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AMAZON_CATEGORIES } from "@/lib/amazon-categories";
import {
  BULK_CATALOG_FIELDS,
  BULK_CATALOG_SKIP,
  type BulkCatalogFieldKey,
  type ColumnMapping,
  autoMapColumns,
  downloadCatalogTemplate,
  mappingCoversRequiredFields,
  parseCatalogUploadFile,
  rowsToImportProducts,
} from "@/lib/bulk-catalog-import";
import { fetchJson } from "@/lib/api-fetch";

type WizardStep = "category" | "file" | "structure";

const STEPS: Array<{ id: WizardStep; label: string; icon: typeof FolderTree }> = [
  { id: "category", label: "Category", icon: FolderTree },
  { id: "file", label: "File", icon: FileSpreadsheet },
  { id: "structure", label: "Structure", icon: Layers },
];

interface BulkUploadCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (summary: { imported: number; failed: number }) => void;
  disabled?: boolean;
}

export function BulkUploadCatalogDialog({
  open,
  onOpenChange,
  onImported,
  disabled,
}: BulkUploadCatalogDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("category");
  const [category, setCategory] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function resetWizard() {
    setStep("category");
    setCategory("");
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setImportError(null);
    setParsing(false);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetWizard();
    onOpenChange(next);
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const previewProducts = useMemo(() => {
    if (!category || rows.length === 0) return [];
    return rowsToImportProducts(rows, mapping, category);
  }, [category, rows, mapping]);

  async function handleFileSelected(file: File) {
    setParseError(null);
    setParsing(true);
    try {
      const parsed = await parseCatalogUploadFile(file);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
      if (parsed.rows.length === 0) {
        setParseError("No data rows found. Add at least one product row below the header.");
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read file.");
      setFileName(null);
      setHeaders([]);
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!category || !mappingCoversRequiredFields(mapping)) return;
    const products = rowsToImportProducts(rows, mapping, category);
    if (products.length === 0) {
      setImportError("No valid rows. Map Product name and SKU columns with at least one filled row.");
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      const result = await fetchJson<{
        imported: Array<{ id: number; name: string }>;
        errors: Array<{ row: number; error: string }>;
      }>(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/products/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const failed = result.errors?.length ?? 0;
      const ok = result.imported?.length ?? 0;
      if (failed > 0 && ok === 0) {
        throw new Error(result.errors.map((e) => `Row ${e.row}: ${e.error}`).join("; "));
      }
      onImported?.({ imported: ok, failed });
      handleOpenChange(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function setColumnMapping(header: string, value: string) {
    setMapping((prev) => ({
      ...prev,
      [header]: value === BULK_CATALOG_SKIP ? BULK_CATALOG_SKIP : (value as BulkCatalogFieldKey),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">Bulk Upload Catalog</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map(({ id, label, icon: Icon }, index) => {
              const active = step === id;
              const done = index < stepIndex;
              return (
                <div key={id} className="flex flex-1 items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      active && "border-blue-500 bg-blue-50 text-blue-600",
                      done && !active && "border-blue-200 bg-blue-50/80 text-blue-500",
                      !active && !done && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium truncate hidden sm:block",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <div className="h-px flex-1 bg-border min-w-[8px]" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-6 min-h-[280px]">
          {step === "category" && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
                <FolderTree className="h-7 w-7" />
              </div>
              <h3 className="text-center text-sm font-semibold text-foreground">
                Which category are you importing?
              </h3>
              <p className="text-center text-xs text-muted-foreground mt-1 mb-5">
                We&apos;ll map your file against this category&apos;s fields.
              </p>
              <Select value={category || undefined} onValueChange={setCategory}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {AMAZON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end mt-6">
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                  disabled={!category}
                  onClick={() => setStep("file")}
                >
                  Continue
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "file" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2 text-xs text-muted-foreground">
                Category: <span className="font-medium text-foreground">{category}</span>
              </div>
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-blue-400/60 bg-card p-8 text-center transition-colors disabled:opacity-60"
              >
                {parsing ? (
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                )}
                <p className="mt-3 text-sm font-medium text-foreground">
                  {fileName ? fileName : "Drop or choose a spreadsheet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  .xlsx or .csv — first row must be column headers
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => downloadCatalogTemplate(`catalog-template-${category.replace(/\s+/g, "-").toLowerCase()}.csv`)}
                >
                  Download template
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep("category")}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                    disabled={!fileName || rows.length === 0 || Boolean(parseError)}
                    onClick={() => setStep("structure")}
                  >
                    Continue
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {parseError && (
                <p className="text-xs text-destructive">{parseError}</p>
              )}
              {rows.length > 0 && !parseError && (
                <p className="text-xs text-muted-foreground">
                  {rows.length} row{rows.length === 1 ? "" : "s"} detected.
                </p>
              )}
            </div>
          )}

          {step === "structure" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Match your file columns to catalog fields. Product name and SKU are required.
              </p>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left font-medium p-2">Your column</th>
                      <th className="text-left font-medium p-2">Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => (
                      <tr key={header} className="border-t border-border">
                        <td className="p-2 font-mono text-[11px]">{header}</td>
                        <td className="p-2">
                          <Select
                            value={mapping[header] ?? BULK_CATALOG_SKIP}
                            onValueChange={(v) => setColumnMapping(header, v)}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={BULK_CATALOG_SKIP}>Skip column</SelectItem>
                              {BULK_CATALOG_FIELDS.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required ? " *" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!mappingCoversRequiredFields(mapping) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  Map columns to <strong>Product name</strong> and <strong>SKU</strong> to continue.
                </p>
              )}
              {previewProducts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ready to import <span className="font-medium text-foreground">{previewProducts.length}</span> product
                  {previewProducts.length === 1 ? "" : "s"} as {category}.
                </p>
              )}
              {importError && (
                <p className="text-xs text-destructive">{importError}</p>
              )}
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep("file")}>
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                  disabled={
                    importing
                    || !mappingCoversRequiredFields(mapping)
                    || previewProducts.length === 0
                  }
                  onClick={() => void handleImport()}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    "Import catalog"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkUploadCatalogTriggerProps {
  disabled?: boolean;
  onImported?: (summary: { imported: number; failed: number }) => void;
}

export function BulkUploadCatalogTrigger({ disabled, onImported }: BulkUploadCatalogTriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Upload className="w-3.5 h-3.5 mr-1.5" />
        Bulk upload
      </Button>
      <BulkUploadCatalogDialog open={open} onOpenChange={setOpen} onImported={onImported} disabled={disabled} />
    </>
  );
}
