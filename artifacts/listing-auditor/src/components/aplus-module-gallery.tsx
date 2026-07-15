import { useState, useRef, useLayoutEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { refreshCreditBalances } from "@/lib/credit-queries";
import { useTeam } from "@/hooks/use-team";
import { Check, Clock, Download, Maximize2, RefreshCw, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AplusModuleVersion {
  url: string;
  isEdit: boolean;
  prompt?: string;
  generatedAt: string;
}

export interface AplusModuleItem {
  id: "hero" | "features" | "comparison" | "brand_story";
  title: string;
  description: string;
  headline: string;
  body: string;
  imageUrl: string;
  aspectRatio?: "16:10" | "9:16" | "1:1";
  versions?: AplusModuleVersion[];
}

type NormalizedAplusModuleItem = AplusModuleItem & { versions: AplusModuleVersion[] };

function normalizeModule(module: AplusModuleItem): NormalizedAplusModuleItem {
  const aspectRatio = module.aspectRatio ?? (module.id === "brand_story" ? "9:16" : "16:10");
  return { ...module, aspectRatio, versions: module.versions ?? [] };
}

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 transition-colors shadow-sm"
    >
      {icon}
    </button>
  );
}

function ModuleDescription({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    if (expanded) {
      setShowToggle(true);
      return;
    }

    const clamped = el.scrollHeight > el.clientHeight + 1;
    setShowToggle(clamped || body.trim().length > 100);
  }, [body, expanded]);

  return (
    <div className="space-y-1.5">
      <p
        ref={textRef}
        className={cn(
          "text-xs text-slate-500 leading-relaxed",
          !expanded && "line-clamp-2",
        )}
      >
        {body}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-medium text-orange-600 hover:text-orange-700"
        >
          {expanded ? "Show less" : "Show full description"}
        </button>
      )}
    </div>
  );
}

function AplusImageCard({
  module,
  isLoading,
  canEdit,
  onView,
  onRegenerate,
  onEdit,
  onHistory,
  onDownload,
}: {
  module: AplusModuleItem;
  isLoading: boolean;
  canEdit: boolean;
  onView: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDownload: () => void;
}) {
  const normalized = normalizeModule(module);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-orange-300 hover:shadow-sm transition-all bg-white">
      <div className="group relative w-full aspect-[16/10] bg-slate-100">
        <img
          src={normalized.imageUrl}
          alt={normalized.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-white" />
            <span className="text-xs text-white/80">Generating…</span>
          </div>
        )}
        {!isLoading && (
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <ActionBtn icon={<Maximize2 className="h-4 w-4" />} title="View full screen" onClick={onView} />
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
      <div className="px-3 py-2 border-t bg-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="text-[10px] py-0 capitalize shrink-0">
            {normalized.title}
          </Badge>
          <span className="text-xs text-slate-400">{normalized.aspectRatio}</span>
        </div>
        {normalized.versions.length > 0 && (
          <span className="text-xs text-slate-400 shrink-0">{normalized.versions.length}v</span>
        )}
      </div>
      <div className="px-4 py-3 space-y-1.5 border-t border-slate-100">
        <p className="text-sm font-semibold text-slate-800">{normalized.headline}</p>
        <ModuleDescription body={normalized.body} />
      </div>
    </div>
  );
}

interface AplusModuleGalleryProps {
  auditId: number;
  modules: AplusModuleItem[];
  onModulesUpdate: (modules: AplusModuleItem[]) => void;
  onLightbox: (url: string) => void;
}

export function AplusModuleGallery({ auditId, modules, onModulesUpdate, onLightbox }: AplusModuleGalleryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = useTeam();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [editModule, setEditModule] = useState<AplusModuleItem | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [historyModule, setHistoryModule] = useState<AplusModuleItem | null>(null);

  const setLoading = (moduleId: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(moduleId);
      else next.delete(moduleId);
      return next;
    });
  };

  const updateModuleInList = (updated: AplusModuleItem) => {
    onModulesUpdate(modules.map((m) => (m.id === updated.id ? updated : m)));
  };

  const regenerateMutation = useMutation({
    mutationFn: async (moduleId: AplusModuleItem["id"]) => {
      const res = await fetch(`${basePath}/api/audits/${auditId}/aplus/${moduleId}/regenerate`, {
        method: "POST",
        credentials: "include",
      });
      let data: { error?: string } = {};
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) as { error?: string } : {};
      } catch {
        if (res.status === 404) {
          throw new Error("A+ regenerate API not found. Rebuild and restart the API server on latest-code.");
        }
      }
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      return JSON.parse(text) as AplusModuleItem;
    },
    onMutate: (moduleId) => setLoading(moduleId, true),
    onSuccess: (updated) => {
      updateModuleInList(updated);
      void refreshCreditBalances(queryClient);
      toast({ title: "Module regenerated", description: `${updated.title} has a new image.` });
    },
    onError: (err: Error) => {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    },
    onSettled: (_data, _err, moduleId) => setLoading(moduleId, false),
  });

  const editMutation = useMutation({
    mutationFn: async ({ moduleId, prompt }: { moduleId: AplusModuleItem["id"]; prompt: string }) => {
      const res = await fetch(`${basePath}/api/audits/${auditId}/aplus/${moduleId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      let data: { error?: string } = {};
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) as { error?: string } : {};
      } catch {
        if (res.status === 404) {
          throw new Error("A+ edit API not found. Rebuild and restart the API server on latest-code.");
        }
      }
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      return JSON.parse(text) as AplusModuleItem;
    },
    onMutate: ({ moduleId }) => setLoading(moduleId, true),
    onSuccess: (updated) => {
      updateModuleInList(updated);
      setEditModule(null);
      setEditPrompt("");
      void refreshCreditBalances(queryClient);
      toast({ title: "Edit applied", description: `${updated.title} was updated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });
    },
    onSettled: (_data, _err, { moduleId }) => setLoading(moduleId, false),
  });

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url.startsWith("http") ? url : `${basePath}${url}`;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">
            Generated A+ Modules ({modules.length})
          </h3>
          <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
            <Check className="w-4 h-4" /> Complete
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map((module) => (
            <AplusImageCard
              key={module.id}
              module={module}
              isLoading={loadingIds.has(module.id)}
              canEdit={canEdit}
              onView={() => onLightbox(module.imageUrl)}
              onRegenerate={() => regenerateMutation.mutate(module.id)}
              onEdit={() => {
                setEditModule(module);
                setEditPrompt("");
              }}
              onHistory={() => setHistoryModule(module)}
              onDownload={() => handleDownload(module.imageUrl, `aplus-${module.id}.png`)}
            />
          ))}
        </div>
      </div>

      <Dialog
        open={!!editModule}
        onOpenChange={(open) => {
          if (!open && editModule && !loadingIds.has(editModule.id)) {
            setEditModule(null);
            setEditPrompt("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit Image with AI
              {editModule && <span className="text-slate-500 font-normal text-sm">— {editModule.title}</span>}
            </DialogTitle>
          </DialogHeader>
          {editModule && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Current</p>
                  <div className="rounded-lg border bg-slate-50 aspect-[16/10] overflow-hidden">
                    <img src={editModule.imageUrl} alt="Current" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">After (shown on apply)</p>
                  <div className="rounded-lg border bg-slate-50/50 aspect-[16/10] flex flex-col items-center justify-center gap-3 text-slate-400">
                    {loadingIds.has(editModule.id) ? (
                      <>
                        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                        <p className="text-sm font-medium text-slate-700">Generating edit…</p>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-7 w-7 opacity-20" />
                        <span className="text-xs text-center px-4">Result appears after applying</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Instructions</label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Warm the background, increase contrast on the product, soften text areas…"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditModule(null)}
                  disabled={loadingIds.has(editModule.id)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => editMutation.mutate({ moduleId: editModule.id, prompt: editPrompt })}
                  disabled={!editPrompt.trim() || loadingIds.has(editModule.id)}
                  className="gap-2"
                >
                  {loadingIds.has(editModule.id) ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {loadingIds.has(editModule.id) ? "Applying…" : "Apply Edit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyModule} onOpenChange={(open) => { if (!open) setHistoryModule(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Version History
              {historyModule && (
                <span className="text-slate-500 font-normal text-sm">— {historyModule.title}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {historyModule && (
            <div className="space-y-4">
              {(() => {
            const history = normalizeModule(historyModule);
            return history.versions.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No version history yet.</p>
                  <p className="text-xs">Regenerate or edit this module to start tracking versions.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {[...history.versions].reverse().map((version, i) => {
                    const versionNum = history.versions.length - i;
                    const isCurrent = version.url === historyModule.imageUrl;
                    return (
                      <div
                        key={`${version.url}-${i}`}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-white",
                          isCurrent && "ring-2 ring-orange-500 border-orange-200",
                        )}
                      >
                        <div className="w-20 h-14 rounded-lg border bg-slate-50 overflow-hidden flex-shrink-0">
                          <img src={version.url} alt={`Version ${versionNum}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {version.isEdit ? "Edit" : "Generate"}
                            </Badge>
                            <span className="text-xs text-slate-400">v{versionNum}</span>
                            {isCurrent && <span className="text-xs text-orange-600 font-medium">Current</span>}
                            <span className="text-xs text-slate-400">
                              {new Date(version.generatedAt).toLocaleString()}
                            </span>
                          </div>
                          {version.prompt && (
                            <p className="text-xs text-slate-500 mt-1 truncate">{version.prompt}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(version.url, `aplus-${historyModule.id}-v${versionNum}.png`)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
          })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
