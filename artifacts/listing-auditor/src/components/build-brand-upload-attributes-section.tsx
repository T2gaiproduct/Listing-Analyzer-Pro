import { useCallback, useMemo, useState } from "react";
import { Link2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";
import {
  REFERENCE_RESEARCH_SLOT_COUNT,
  SELLER_PRODUCT_DETAIL_MAX,
  type ReferenceResearchData,
  type ReferenceResearchSlot,
  type SellerProductDetail,
} from "@/lib/reference-research";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function normalizeAttributeRows(rows: SellerProductDetail[] | undefined): SellerProductDetail[] {
  if (!rows?.length) return [{ attribute: "", value: "" }];
  return rows.map((row) => ({
    attribute: row.attribute ?? "",
    value: row.value ?? "",
  }));
}

function activeReferenceSlots(slots: ReferenceResearchSlot[] | undefined): ReferenceResearchSlot[] {
  return (slots ?? []).filter((s) => s.url.trim() || s.notes.trim());
}

function trimProductDetailsForSave(rows: SellerProductDetail[]): SellerProductDetail[] | undefined {
  const trimmed = rows
    .map((row) => ({
      attribute: row.attribute.trim(),
      value: row.value.trim(),
    }))
    .filter((row) => row.attribute || row.value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function slotsForApi(dynamicSlots: ReferenceResearchSlot[]): ReferenceResearchSlot[] {
  return dynamicSlots.slice(0, REFERENCE_RESEARCH_SLOT_COUNT);
}

export function BuildBrandUploadAttributesSection({
  auditId,
  initialData,
  creditLabel = "1 AI credit",
  onEnsureAudit,
  onResearchUpdated,
}: {
  auditId: number | null;
  initialData?: ReferenceResearchData | null;
  creditLabel?: string;
  onEnsureAudit: () => Promise<number | null>;
  onResearchUpdated?: (data: ReferenceResearchData) => void;
}) {
  const { toast } = useToast();
  const [productDetails, setProductDetails] = useState<SellerProductDetail[]>(() =>
    normalizeAttributeRows(initialData?.productDetails),
  );
  const [referenceSlots, setReferenceSlots] = useState<ReferenceResearchSlot[]>(() =>
    activeReferenceSlots(initialData?.slots),
  );
  const [analyzedAt, setAnalyzedAt] = useState(initialData?.analyzedAt);
  const [fetchErrors, setFetchErrors] = useState(initialData?.fetchErrors);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const hasAnalyzeInput = useMemo(
    () => referenceSlots.some((s) => s.url.trim() || s.notes.trim()),
    [referenceSlots],
  );

  const resolveAuditId = useCallback(async (): Promise<number | null> => {
    if (auditId && auditId > 0) return auditId;
    return onEnsureAudit();
  }, [auditId, onEnsureAudit]);

  const persist = useCallback(
    async (overrides?: {
      productDetails?: SellerProductDetail[];
      slots?: ReferenceResearchSlot[];
    }) => {
      const id = await resolveAuditId();
      if (!id) return null;
      setSaving(true);
      try {
        const payload: ReferenceResearchData = {
          slots: slotsForApi(overrides?.slots ?? referenceSlots),
          productDetails: trimProductDetailsForSave(overrides?.productDetails ?? productDetails),
          analyzedAt,
          fetchErrors,
        };
        const saved = await fetchJson<ReferenceResearchData>(
          `${basePath}/api/audits/${id}/reference-research`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        onResearchUpdated?.(saved);
        return saved;
      } catch (err) {
        toast({
          title: "Could not save attributes",
          description: err instanceof ApiFetchError ? err.message : "Please try again.",
          variant: "destructive",
        });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [analyzedAt, fetchErrors, onResearchUpdated, productDetails, referenceSlots, resolveAuditId, toast],
  );

  async function handleAnalyze() {
    if (!hasAnalyzeInput) return;
    const id = await resolveAuditId();
    if (!id) return;
    setAnalyzing(true);
    try {
      await persist();
      const slots = slotsForApi(referenceSlots);
      const result = await fetchJson<ReferenceResearchData>(
        `${basePath}/api/audits/${id}/reference-research/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots }),
        },
      );
      setReferenceSlots(activeReferenceSlots(result.slots));
      setAnalyzedAt(result.analyzedAt);
      setFetchErrors(result.fetchErrors);
      if (result.productDetails?.length) {
        setProductDetails(normalizeAttributeRows(result.productDetails));
      }
      onResearchUpdated?.(result);
      void refreshCredits();
      toast({
        title: "Reference analysis complete",
        description: `Attribute suggestions updated. ${creditLabel} was used.`,
      });
    } catch (err) {
      toast({
        title: "Analyze failed",
        description: err instanceof ApiFetchError ? err.message : "Analysis failed.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function refreshCredits() {
    try {
      const { refreshCreditBalances } = await import("@/lib/credit-queries");
      await refreshCreditBalances();
    } catch {
      /* non-fatal */
    }
  }

  const updateReference = (index: number, patch: Partial<ReferenceResearchSlot>) => {
    setReferenceSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const removeReference = (index: number) => {
    const next = referenceSlots.filter((_, i) => i !== index);
    setReferenceSlots(next);
    void persist({ slots: next });
  };

  const addReference = () => {
    if (referenceSlots.length >= REFERENCE_RESEARCH_SLOT_COUNT) return;
    setReferenceSlots((prev) => [...prev, { url: "", notes: "" }]);
  };

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
          <Link2 className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Attributes</p>
          <p className="text-xs text-muted-foreground">
            Product specs for listing preview. Optional reference URLs can suggest values (research only).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {productDetails.map((row, index) => (
          <div
            key={`attr-${index}`}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,34%)_minmax(0,1fr)_auto] gap-2 items-start rounded-xl border border-border bg-muted/30 p-3"
          >
            <label className="block space-y-1 min-w-0">
              <span className="text-xs font-medium text-foreground">Attribute name</span>
              <Input
                value={row.attribute}
                placeholder="e.g. Material, Item dimensions"
                className="border-border rounded-xl h-10 text-sm"
                onChange={(e) =>
                  setProductDetails((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, attribute: e.target.value } : r)),
                  )
                }
                onBlur={() => void persist()}
              />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="text-xs font-medium text-foreground">Value</span>
              <Input
                value={row.value}
                placeholder="e.g. ABS plastic; 24 × 18 × 5 cm"
                className="border-border rounded-xl h-10 text-sm"
                onChange={(e) =>
                  setProductDetails((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)),
                  )
                }
                onBlur={() => void persist()}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-600 sm:mt-6"
              disabled={productDetails.length <= 1}
              onClick={() => {
                const next = productDetails.filter((_, i) => i !== index);
                const normalized = next.length > 0 ? next : [{ attribute: "", value: "" }];
                setProductDetails(normalized);
                void persist({ productDetails: normalized });
              }}
              aria-label="Remove attribute"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl text-xs"
          disabled={productDetails.length >= SELLER_PRODUCT_DETAIL_MAX || saving}
          onClick={() => setProductDetails((prev) => [...prev, { attribute: "", value: "" }])}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add attribute
        </Button>
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
        Add competitor or marketplace URLs to analyze common attributes. Research signals do not copy into your listing.
        <span className="font-semibold"> Analyze uses {creditLabel}.</span>
      </div>

      <div className="space-y-2">
        {referenceSlots.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No reference listings yet.</p>
        ) : (
          referenceSlots.map((slot, index) => (
            <div
              key={`ref-${index}`}
              className="rounded-xl border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Reference {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  onClick={() => removeReference(index)}
                  aria-label="Remove reference"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">Product URL</span>
                <Input
                  value={slot.url}
                  placeholder="Product page URL or Amazon ASIN…"
                  className="border-border rounded-xl h-10 text-sm"
                  onChange={(e) => updateReference(index, { url: e.target.value })}
                  onBlur={() => void persist()}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">Notes (optional)</span>
                <Textarea
                  value={slot.notes}
                  placeholder="Observed attributes or keywords — not copied verbatim."
                  className="border-border rounded-xl min-h-[72px] text-sm resize-y"
                  onChange={(e) => updateReference(index, { notes: e.target.value })}
                  onBlur={() => void persist()}
                />
              </label>
              {fetchErrors?.some((err) => err.index === index) && (
                <p className="text-[11px] text-red-600">
                  {fetchErrors.find((err) => err.index === index)?.message}
                </p>
              )}
            </div>
          ))
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl text-xs"
            disabled={referenceSlots.length >= REFERENCE_RESEARCH_SLOT_COUNT || saving}
            onClick={addReference}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add reference
          </Button>
          {referenceSlots.length >= REFERENCE_RESEARCH_SLOT_COUNT && (
            <span className="text-[11px] text-muted-foreground">Maximum {REFERENCE_RESEARCH_SLOT_COUNT} references.</span>
          )}
        </div>
      </div>

      {hasAnalyzeInput && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold"
            disabled={analyzing || saving}
            onClick={() => void handleAnalyze()}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze references
              </>
            )}
          </Button>
          {analyzedAt && (
            <p className="text-[11px] text-muted-foreground">
              Last analyzed {new Date(analyzedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Enter product name and category above before saving. Tab out of a field to save attributes to your project.
      </p>
    </div>
  );
}
