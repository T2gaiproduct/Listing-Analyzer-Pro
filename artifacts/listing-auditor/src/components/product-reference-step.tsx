import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  REFERENCE_RESEARCH_SLOT_COUNT,
  type ReferenceIntelligenceRow,
  type ReferenceResearchData,
  type ReferenceResearchSlot,
} from "@/lib/reference-research";
import { ReferenceIntelligenceTable } from "@/components/reference-intelligence-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fetchJson, ApiFetchError } from "@/lib/api-fetch";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function normalizeSlots(slots: ReferenceResearchSlot[] | undefined): ReferenceResearchSlot[] {
  const out: ReferenceResearchSlot[] = [];
  for (let i = 0; i < REFERENCE_RESEARCH_SLOT_COUNT; i++) {
    const slot = slots?.[i];
    out.push({ url: slot?.url ?? "", notes: slot?.notes ?? "" });
  }
  return out;
}

export function ProductReferenceStep({
  auditId,
  initialData,
  canEdit,
  creditLabel = "1 AI credit",
  onResearchUpdated,
}: {
  auditId: number;
  initialData?: ReferenceResearchData | null;
  canEdit: boolean;
  /** Shown near Analyze — e.g. "1 AI credit" from credit rules. */
  creditLabel?: string;
  onResearchUpdated?: (data: ReferenceResearchData) => void;
}) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<ReferenceResearchSlot[]>(() => normalizeSlots(initialData?.slots));
  const [intelligence, setIntelligence] = useState<ReferenceIntelligenceRow[] | undefined>(
    initialData?.intelligence,
  );
  const [fetchErrors, setFetchErrors] = useState(initialData?.fetchErrors);
  const [analyzedAt, setAnalyzedAt] = useState(initialData?.analyzedAt);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setSlots(normalizeSlots(initialData?.slots));
    setIntelligence(initialData?.intelligence);
    setFetchErrors(initialData?.fetchErrors);
    setAnalyzedAt(initialData?.analyzedAt);
  }, [initialData, auditId]);

  const hasAnalyzeInput = useMemo(
    () => slots.some((s) => s.url.trim() || s.notes.trim()),
    [slots],
  );

  const saveSlots = useCallback(async () => {
    if (!canEdit || auditId <= 0) return;
    setSaving(true);
    try {
      const payload: ReferenceResearchData = {
        slots,
        intelligence,
        analyzedAt,
        fetchErrors,
      };
      const saved = await fetchJson<ReferenceResearchData>(
        `${basePath}/api/audits/${auditId}/reference-research`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      onResearchUpdated?.(saved);
    } catch (err) {
      toast({
        title: "Could not save references",
        description: err instanceof ApiFetchError ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [auditId, analyzedAt, canEdit, fetchErrors, intelligence, onResearchUpdated, slots, toast]);

  const updateSlot = (index: number, patch: Partial<ReferenceResearchSlot>) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  async function handleAnalyze() {
    if (!canEdit || !hasAnalyzeInput) return;
    setAnalyzing(true);
    try {
      await saveSlots();
      const result = await fetchJson<ReferenceResearchData>(
        `${basePath}/api/audits/${auditId}/reference-research/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots }),
        },
      );
      setSlots(normalizeSlots(result.slots));
      setIntelligence(result.intelligence);
      setFetchErrors(result.fetchErrors);
      setAnalyzedAt(result.analyzedAt);
      onResearchUpdated?.(result);
      toast({
        title: "Reference intelligence ready",
        description: `Attribute patterns generated. ${creditLabel} was used.`,
      });
    } catch (err) {
      const message = err instanceof ApiFetchError ? err.message : "Analysis failed.";
      toast({
        title: "Analyze failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const statusHint = analyzing
    ? "Analyzing references…"
    : intelligence?.length
      ? `Last analyzed ${analyzedAt ? new Date(analyzedAt).toLocaleString() : ""}`
      : hasAnalyzeInput
        ? "Ready to analyze reference URLs and notes."
        : "Waiting for reference URLs and/or notes.";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              2. Reference listings
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Add comparable product URLs and short notes. Fetched data is used for research signals only — never copied into your listing.
            </p>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-2 py-0.5">
            Research only · max {REFERENCE_RESEARCH_SLOT_COUNT}
          </span>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[10px] text-amber-900 leading-relaxed">
          Analyze references to generate attribute intelligence for seller verification. This does not auto-update your listing copy.
          <span className="font-semibold"> Generating attributes uses {creditLabel}.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {slots.map((slot, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  Reference {index + 1}
                </p>
                <span className="text-[9px] text-slate-400">Optional</span>
              </div>
              <label className="block space-y-1">
                <span className="text-[9px] font-medium text-slate-500">Product URL</span>
                <Input
                  value={slot.url}
                  disabled={!canEdit}
                  placeholder="Product page URL or Amazon ASIN…"
                  className="h-8 text-[11px]"
                  onChange={(e) => updateSlot(index, { url: e.target.value })}
                  onBlur={() => void saveSlots()}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[9px] font-medium text-slate-500">
                  Research notes / observed attributes
                </span>
                <Textarea
                  value={slot.notes}
                  disabled={!canEdit}
                  placeholder="Paste non-copied notes, common attributes or keywords."
                  className="min-h-[72px] text-[11px] resize-y"
                  onChange={(e) => updateSlot(index, { notes: e.target.value })}
                  onBlur={() => void saveSlots()}
                />
              </label>
              {fetchErrors?.some((err) => err.index === index) && (
                <p className="text-[9px] text-red-600">
                  {fetchErrors.find((err) => err.index === index)?.message}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <Button
            type="button"
            size="sm"
            className="h-8 text-[11px] font-semibold uppercase tracking-wide"
            disabled={!canEdit || !hasAnalyzeInput || analyzing || saving}
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
          <p className="text-[10px] text-slate-500">{statusHint}</p>
          <p className="text-[10px] text-slate-400 ml-auto">
            Charges <span className="font-medium text-slate-600">{creditLabel}</span> per analyze run
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 bg-slate-50/80">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            Reference intelligence
          </p>
          <span className="text-[9px] font-medium uppercase tracking-wide text-orange-600">
            AI extracted / research signal
          </span>
        </div>

        {!intelligence?.length ? (
          <p className="text-[11px] text-slate-500 px-3.5 py-8 text-center">
            Run Analyze references to generate attribute patterns for verification.
          </p>
        ) : (
          <ReferenceIntelligenceTable rows={intelligence} />
        )}

        <p className="text-[9px] text-slate-400 px-3.5 py-2.5 border-t border-slate-100 leading-relaxed">
          Research values are prompts for seller confirmation. Exact dimensions, weight, batteries, included items, origin, compliance and safety claims always require product evidence.
        </p>
      </div>
    </div>
  );
}
