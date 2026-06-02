import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/hooks/use-team";
import {
  Download, RefreshCw, Wand2, ImageIcon, Loader2, ArrowLeft,
  MoreVertical, Trash2, Maximize2,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ImageRecord {
  id: string;
  type: "lifestyle" | "feature";
  index: number;
  style: string;
  aspectRatio: string;
  currentUrl: string;
  versions: Array<{ url: string; style: string; aspectRatio: string; isEdit: boolean; generatedAt: string }>;
}

interface GraphicsProject {
  id: number;
  name: string;
  productName: string;
  category: string | null;
  designStyle: string;
  status: string;
  lifestyleCount: number;
  featureCount: number;
  imageRecords?: ImageRecord[];
  updatedAt: string;
}

function fetchProject(id: string): Promise<GraphicsProject> {
  return fetch(`${basePath}/api/graphics/projects/${id}`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch project");
    return r.json();
  });
}

export default function ProjectDetail({ params }: { params?: { id?: string } }) {
  const id = params?.id ?? "";
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canEdit } = useTeam();

  // Read returnTo from query param so admin can go back to admin logs
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/projects";

  const [editImageId, setEditImageId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["graphics-project", id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });

  const editMutation = useMutation({
    mutationFn: async ({ imageId, prompt }: { imageId: string; prompt: string }) => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}/images/${imageId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ editPrompt: prompt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Edit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["graphics-project", id] });
      setEditImageId(null);
      setEditPrompt("");
      toast({ title: "Image updated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Edit failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${basePath}/api/graphics/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Project deleted" });
      nav(returnTo);
    },
  });

  const handleDownload = async (url: string, filename: string) => {
    const fullUrl = url.startsWith("http") ? url : `${basePath}${url}`;
    try {
      const response = await fetch(fullUrl, { credentials: "include" });
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleDownloadAll = async () => {
    if (!project?.imageRecords) return;
    for (const record of project.imageRecords) {
      await handleDownload(record.currentUrl, `${record.id}.png`);
    }
    toast({ title: "Downloaded all images" });
  };

  const records = project?.imageRecords ?? [];
  const lifestyleRecords = records.filter((r) => r.type === "lifestyle");
  const featureRecords = records.filter((r) => r.type === "feature");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => nav(returnTo)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{project?.name ?? "Project"}</h1>
            <p className="text-sm text-slate-500">
              {project?.status === "completed" ? "Your graphics are ready!" : "Generating..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project?.status === "completed" && (
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleDownloadAll}>
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowDelete(true)} className="text-slate-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}

      {!isLoading && project?.status === "failed" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center">
            <p className="text-red-600 font-medium">Generation failed</p>
            <p className="text-sm text-red-400 mt-1">Please try again or contact support.</p>
          </CardContent>
        </Card>
      )}

      {/* Lifestyle Images */}
      {!isLoading && lifestyleRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Lifestyle Images ({lifestyleRecords.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lifestyleRecords.map((record) => (
              <ImageCard
                key={record.id}
                record={record}
                canEdit={canEdit}
                onEdit={() => { setEditImageId(record.id); setEditPrompt(""); }}
                onDownload={() => handleDownload(record.currentUrl, `${record.id}.png`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feature Graphics */}
      {!isLoading && featureRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Feature Graphics ({featureRecords.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {featureRecords.map((record) => (
              <ImageCard
                key={record.id}
                record={record}
                canEdit={canEdit}
                onEdit={() => { setEditImageId(record.id); setEditPrompt(""); }}
                onDownload={() => handleDownload(record.currentUrl, `${record.id}.png`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && project?.status === "completed" && records.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">No images generated</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editImageId} onOpenChange={(o) => !o && setEditImageId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Describe how you want to change this image..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditImageId(null)}>Cancel</Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!editPrompt.trim() || editMutation.isPending}
                onClick={() => {
                  if (editImageId) editMutation.mutate({ imageId: editImageId, prompt: editPrompt });
                }}
              >
                {editMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Apply Edit
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">Are you sure you want to delete this project? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageCard({ record, canEdit, onEdit, onDownload }: {
  record: ImageRecord;
  canEdit: boolean;
  onEdit: () => void;
  onDownload: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const fullUrl = record.currentUrl.startsWith("http") ? record.currentUrl : `${basePath}${record.currentUrl}`;

  return (
    <div
      className="relative rounded-lg border border-slate-100 overflow-hidden bg-white hover:shadow-md transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="aspect-square relative">
        <img src={record.currentUrl} alt="" className="w-full h-full object-cover" />
        {hovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <button
              className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 transition-colors"
              title="View full screen"
              onClick={() => window.open(fullUrl, "_blank")}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {canEdit && (
              <button
                className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 transition-colors"
                title="Edit with AI"
                onClick={onEdit}
              >
                <Wand2 className="w-4 h-4" />
              </button>
            )}
            <button
              className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 transition-colors"
              title="Download"
              onClick={onDownload}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
