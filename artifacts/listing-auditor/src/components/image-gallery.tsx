import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateImages,
  useRegenerateImage,
  useEditImage,
  getGetAuditQueryKey,
} from "@workspace/api-client-react";
import type { ImageRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTeam } from "@/hooks/use-team";
import {
  RefreshCw,
  Sparkles,
  Download,
  Clock,
  ImageIcon,
  Wand2,
} from "lucide-react";

type ImageStyle = "premium" | "minimal" | "luxury" | "modern" | "infographic" | "lifestyle";
type AspectRatio = "1:1" | "3:2" | "2:3";
type ImageType = "main" | "infographic" | "lifestyle";

const STYLES: { value: ImageStyle; label: string; desc: string }[] = [
  { value: "premium", label: "Premium", desc: "Studio white background, crisp lighting" },
  { value: "minimal", label: "Minimal", desc: "Scandinavian, generous white space" },
  { value: "luxury", label: "Luxury", desc: "Moody, dramatic, opulent feel" },
  { value: "modern", label: "Modern", desc: "Bold angles, vibrant accent colors" },
  { value: "infographic", label: "Infographic", desc: "Callout arrows, feature layout" },
  { value: "lifestyle", label: "Lifestyle", desc: "Natural light, real-world setting" },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; symbol: string }[] = [
  { value: "1:1", label: "Square", symbol: "⬜" },
  { value: "3:2", label: "Wide", symbol: "▬" },
  { value: "2:3", label: "Tall", symbol: "▮" },
];

const TYPE_LABELS: Record<ImageType, string> = {
  main: "Main Product",
  infographic: "Infographic",
  lifestyle: "Lifestyle",
};

const TYPE_DESCS: Record<ImageType, string> = {
  main: "Clean white background — Amazon's primary image slot requirement",
  infographic: "Feature callout layout — secondary image slots",
  lifestyle: "In-context usage shots — boosts conversion",
};

function legacyToRecords(legacy: {
  main?: string[];
  infographic?: string[];
  lifestyle?: string[];
}): ImageRecord[] {
  const records: ImageRecord[] = [];
  (["main", "infographic", "lifestyle"] as const).forEach((type) => {
    (legacy[type] ?? []).forEach((url, index) => {
      records.push({
        id: `${type}_${index}`,
        type,
        index,
        style: "premium",
        aspectRatio: "1:1",
        currentUrl: url,
        versions: [],
      });
    });
  });
  return records;
}

interface ImageCardProps {
  record: ImageRecord;
  isLoading: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDownload: () => void;
}

function ImageCard({ record, isLoading, onRegenerate, onEdit, onHistory, onDownload, canEdit }: ImageCardProps & { canEdit: boolean }) {
  return (
    <div className="group relative rounded-lg border overflow-hidden bg-muted/20">
      <div className="aspect-square relative overflow-hidden">
        <img
          src={record.currentUrl}
          alt={`${record.type} ${record.index + 1}`}
          className="w-full h-full object-contain"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-background/75 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Generating…</span>
          </div>
        )}
        {!isLoading && (
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {canEdit && (
              <>
                <ActionBtn icon={<RefreshCw className="h-4 w-4" />} title="Regenerate" onClick={onRegenerate} />
                <ActionBtn icon={<Wand2 className="h-4 w-4" />} title="Edit with AI" onClick={onEdit} />
              </>
            )}
            <ActionBtn icon={<Clock className="h-4 w-4" />} title="Version history" onClick={onHistory} />
            <ActionBtn icon={<Download className="h-4 w-4" />} title="Download" onClick={onDownload} />
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] capitalize py-0">
            {record.style}
          </Badge>
          <span className="text-xs text-muted-foreground">{record.aspectRatio}</span>
        </div>
        {record.versions.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {record.versions.length}v
          </span>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-full bg-background/90 hover:bg-background text-foreground transition-colors shadow-sm"
    >
      {icon}
    </button>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-lg border overflow-hidden bg-muted/20">
      <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="text-xs">Generating…</span>
      </div>
      <div className="px-3 py-2 border-t bg-card">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

interface StyleChipsProps {
  selected: ImageStyle;
  onChange: (s: ImageStyle) => void;
  size?: "sm" | "md";
}

function StyleChips({ selected, onChange, size = "md" }: StyleChipsProps) {
  const cls = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {STYLES.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`${cls} rounded-full font-medium border transition-all ${
            selected === s.value
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background border-border hover:border-primary/50 hover:bg-accent"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

interface RatioToggleProps {
  selected: AspectRatio;
  onChange: (r: AspectRatio) => void;
  size?: "sm" | "md";
}

function RatioToggle({ selected, onChange, size = "md" }: RatioToggleProps) {
  const cls = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div className="flex gap-2">
      {ASPECT_RATIOS.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`${cls} flex items-center gap-1.5 rounded-lg font-medium border transition-all ${
            selected === r.value
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background border-border hover:border-primary/50 hover:bg-accent"
          }`}
        >
          <span>{r.symbol}</span>
          {r.value}
        </button>
      ))}
    </div>
  );
}

export interface ImageGalleryProps {
  auditId: number;
  productName: string;
  imageRecords?: ImageRecord[] | null;
  generatedImages?: { main?: string[]; infographic?: string[]; lifestyle?: string[] } | null;
}

export function ImageGallery({
  auditId,
  productName,
  imageRecords,
  generatedImages,
}: ImageGalleryProps) {
  const queryClient = useQueryClient();
  const { canEdit } = useTeam();

  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>("premium");
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("1:1");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const [editRecord, setEditRecord] = useState<ImageRecord | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editStyle, setEditStyle] = useState<ImageStyle>("premium");
  const [editRatio, setEditRatio] = useState<AspectRatio>("1:1");

  const [historyRecord, setHistoryRecord] = useState<ImageRecord | null>(null);

  const generateImages = useGenerateImages();
  const regenerateImage = useRegenerateImage();
  const editImage = useEditImage();

  const records: ImageRecord[] =
    imageRecords ?? (generatedImages ? legacyToRecords(generatedImages) : []);
  const hasRecords = records.length > 0;
  const isLegacy = !imageRecords && !!generatedImages;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
  }, [queryClient, auditId]);

  const setLoading = (id: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleGenerateAll = async () => {
    setLoadingIds(new Set(["__all__"]));
    try {
      await generateImages.mutateAsync({
        id: auditId,
        data: { style: selectedStyle, aspectRatio: selectedRatio },
      });
      invalidate();
      toast.success("All 6 images generated successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image generation failed";
      toast.error(
        msg.includes("spend limit")
          ? "AI spend limit reached. Please try again later."
          : msg,
      );
    } finally {
      setLoadingIds(new Set());
    }
  };

  const handleRegenerateOne = async (record: ImageRecord) => {
    setLoading(record.id, true);
    try {
      await regenerateImage.mutateAsync({
        id: auditId,
        type: record.type as "main" | "infographic" | "lifestyle",
        index: record.index,
        data: { style: selectedStyle, aspectRatio: selectedRatio },
      });
      invalidate();
      toast.success(
        `${TYPE_LABELS[record.type as ImageType]} image ${record.index + 1} regenerated`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Regeneration failed";
      toast.error(
        msg.includes("spend limit")
          ? "AI spend limit reached. Please try again later."
          : msg,
      );
    } finally {
      setLoading(record.id, false);
    }
  };

  const handleOpenEdit = (record: ImageRecord) => {
    setEditRecord(record);
    setEditPrompt("");
    setEditStyle((record.style as ImageStyle) || "premium");
    setEditRatio((record.aspectRatio as AspectRatio) || "1:1");
  };

  const handleEditSubmit = async () => {
    if (!editRecord || !editPrompt.trim()) return;
    const id = editRecord.id;
    setLoading(id, true);
    try {
      await editImage.mutateAsync({
        id: auditId,
        type: editRecord.type as "main" | "infographic" | "lifestyle",
        index: editRecord.index,
        data: { prompt: editPrompt, style: editStyle, aspectRatio: editRatio },
      });
      invalidate();
      setEditRecord(null);
      toast.success("Image edited successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Edit failed";
      toast.error(
        msg.includes("spend limit")
          ? "AI spend limit reached. Please try again later."
          : msg.includes("Source image file not found")
            ? "Source file not found — please regenerate the image first."
            : msg,
      );
    } finally {
      setLoading(id, false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const isGeneratingAll = loadingIds.has("__all__");
  const types: ImageType[] = ["main", "infographic", "lifestyle"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">AI Product Images</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasRecords
              ? `${records.length} images${isLegacy ? " — legacy format, regenerate to unlock per-image controls" : ""}`
              : "Generate studio-quality product images with AI"}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || loadingIds.size > 0}
            className="gap-2"
          >
            {isGeneratingAll ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGeneratingAll
              ? "Generating…"
              : hasRecords
                ? "Regenerate All"
                : "Generate All"}
          </Button>
        )}
      </div>

      {/* Controls */}
      {canEdit && (
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Style Preset
          </p>
          <StyleChips selected={selectedStyle} onChange={setSelectedStyle} />
          <p className="text-xs text-muted-foreground mt-1.5 italic">
            {STYLES.find((s) => s.value === selectedStyle)?.desc}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Aspect Ratio
          </p>
          <RatioToggle selected={selectedRatio} onChange={setSelectedRatio} />
        </div>
      </div>
      )}

      {/* Empty state */}
      {!hasRecords && !isGeneratingAll && (
        <div className="rounded-lg border border-dashed bg-muted/20 py-16 flex flex-col items-center gap-3">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Choose a style and click <strong>Generate All</strong> to create 6 product images.
          </p>
        </div>
      )}

      {/* Image type sections */}
      {(hasRecords || isGeneratingAll) &&
        types.map((type) => {
          const typeRecords = records.filter((r) => r.type === type);
          if (typeRecords.length === 0 && !isGeneratingAll) return null;
          return (
            <div key={type} className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{TYPE_LABELS[type]}</h4>
                <p className="text-xs text-muted-foreground">{TYPE_DESCS[type]}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {typeRecords.map((record) => (
                  <ImageCard
                    key={record.id}
                    record={record}
                    isLoading={loadingIds.has(record.id) || isGeneratingAll}
                    canEdit={canEdit}
                    onRegenerate={() => handleRegenerateOne(record)}
                    onEdit={() => handleOpenEdit(record)}
                    onHistory={() => setHistoryRecord(record)}
                    onDownload={() =>
                      handleDownload(
                        record.currentUrl,
                        `${productName}-${record.id}.png`,
                      )
                    }
                  />
                ))}
                {isGeneratingAll && typeRecords.length === 0 && (
                  <>
                    <LoadingCard />
                    <LoadingCard />
                  </>
                )}
              </div>
            </div>
          );
        })}

      {/* ── Edit Dialog ── */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => {
          if (!open && !loadingIds.has(editRecord?.id ?? "")) setEditRecord(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit Image with AI
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4">
              {/* Before / After preview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Current</p>
                  <div className="rounded-lg border bg-muted aspect-square overflow-hidden">
                    <img
                      src={editRecord.currentUrl}
                      alt="Current"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    After (shown on apply)
                  </p>
                  <div className="rounded-lg border bg-muted/40 aspect-square flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    {loadingIds.has(editRecord.id) ? (
                      <>
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                          <Wand2 className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm font-medium text-foreground">Generating edit…</p>
                          <p className="text-xs mt-1">This takes 30–60 seconds</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-7 w-7 opacity-20" />
                        <span className="text-xs text-center px-4">
                          Result appears here after applying
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Instructions</label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Add a subtle green leaf in the top-right corner, warm the background slightly, add a soft glow around the product..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Style + Ratio overrides */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Style
                  </p>
                  <StyleChips selected={editStyle} onChange={setEditStyle} size="sm" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Aspect Ratio
                  </p>
                  <RatioToggle selected={editRatio} onChange={setEditRatio} size="sm" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditRecord(null)}
                  disabled={loadingIds.has(editRecord.id)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={!editPrompt.trim() || loadingIds.has(editRecord.id)}
                  className="gap-2"
                >
                  {loadingIds.has(editRecord.id) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {loadingIds.has(editRecord.id) ? "Applying…" : "Apply Edit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ── */}
      <Dialog
        open={!!historyRecord}
        onOpenChange={(open) => {
          if (!open) setHistoryRecord(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Version History
              {historyRecord && (
                <span className="text-muted-foreground font-normal text-sm">
                  — {TYPE_LABELS[historyRecord.type as ImageType]}{" "}
                  {historyRecord.index + 1}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {historyRecord && (
            <div className="space-y-4">
              {historyRecord.versions.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No version history (legacy image).</p>
                  <p className="text-xs">Regenerate this image to start tracking versions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {[...historyRecord.versions].reverse().map((v, i) => {
                    const isCurrent = i === 0;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border overflow-hidden ${isCurrent ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="aspect-square bg-muted">
                          <img
                            src={v.url}
                            alt={`Version ${historyRecord.versions.length - i}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-2 text-xs space-y-1 bg-card">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{v.style}</span>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {v.aspectRatio} · {v.isEdit ? "Edit" : "Generated"}
                          </div>
                          {v.prompt && (
                            <div className="text-muted-foreground italic line-clamp-2">
                              "{v.prompt}"
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            {new Date(v.generatedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-6 text-xs mt-1"
                            onClick={() =>
                              handleDownload(
                                v.url,
                                `${productName}-${historyRecord.id}-v${historyRecord.versions.length - i}.png`,
                              )
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setHistoryRecord(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
