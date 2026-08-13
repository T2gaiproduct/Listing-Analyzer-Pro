import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  MoreHorizontal,
  PenLine,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { getGetAuditQueryKey, getGetRecentsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { projectTypeToFeature } from "@/lib/workspace-route-access";
import { ProjectShareMenu } from "@/components/project-share-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PROJECT_TYPE = "listing";

export function ProductDetailRibbon({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    isAccountOwner,
    can: wsCan,
    canEdit: wsCanEdit,
    canDelete: wsCanDelete,
  } = useWorkspace();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const projectCtx = { type: PROJECT_TYPE, id: productId };
  const ribbonFeature = projectTypeToFeature(PROJECT_TYPE);
  const canEdit = isAccountOwner || wsCanEdit(ribbonFeature);
  const canArchive =
    isAccountOwner || wsCan("archive", "edit") || wsCanEdit(ribbonFeature);
  const canDelete = isAccountOwner || wsCanDelete(ribbonFeature);

  const recentsQueryKey = getGetRecentsQueryKey({ limit: 200 });

  function invalidateRecents() {
    void queryClient.invalidateQueries({ queryKey: recentsQueryKey });
  }

  const pinMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, id }),
      });
      if (!r.ok) throw new Error("Pin failed");
      return r.json();
    },
    onSuccess: invalidateRecents,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ type, id, name }: { type: string; id: number; name: string }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Rename failed");
      return r.json();
    },
    onSuccess: (_data, { id }) => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!r.ok) throw new Error("Archive failed");
      return r.json();
    },
    onSuccess: () => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: invalidateRecents,
  });

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/products/${productId}`
      : `${basePath}/products/${productId}`;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  function handleRename() {
    setMenuOpen(false);
    setRenameModalOpen(true);
    setRenameValue(productName);
  }

  function handleRenameSubmit() {
    const name = renameValue.trim();
    if (!name) {
      toast({
        title: "No name entered",
        description: "Please enter a new name.",
        variant: "destructive",
      });
      return;
    }
    renameMutation
      .mutateAsync({ type: projectCtx.type, id: projectCtx.id, name })
      .then(() => {
        setRenameModalOpen(false);
        setRenameValue("");
        toast({ title: "Renamed", description: "Project name updated." });
      })
      .catch(() => {
        toast({
          title: "Failed",
          description: "Could not rename this project.",
          variant: "destructive",
        });
      });
  }

  function handlePin() {
    setMenuOpen(false);
    pinMutation.mutate(
      { type: projectCtx.type, id: projectCtx.id },
      {
        onSuccess: () => {
          toast({ title: "Pinned", description: "Project pinned to the top of your sidebar." });
        },
        onError: () => {
          toast({
            title: "Failed",
            description: "Could not pin this project.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleArchive() {
    setMenuOpen(false);
    archiveMutation.mutate(
      { type: projectCtx.type, id: projectCtx.id },
      {
        onSuccess: () => {
          toast({ title: "Archived", description: "Project moved to Archive." });
          navigate("/archive");
        },
        onError: () => {
          toast({
            title: "Failed",
            description: "Could not archive this project.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleDelete() {
    setMenuOpen(false);
    setDeleteConfirmOpen(true);
  }

  function confirmDelete() {
    setDeleteConfirmOpen(false);
    deleteMutation.mutate(
      { type: projectCtx.type, id: projectCtx.id },
      {
        onSuccess: () => {
          toast({ title: "Deleted", description: "Project has been permanently deleted." });
          navigate("/products");
        },
        onError: () => {
          toast({
            title: "Failed",
            description: "Could not delete this project.",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-0 min-h-[34px] py-1 px-2.5 sm:px-3 bg-slate-50/80 border border-slate-200 rounded-lg">
        <Link
          href="/products"
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-md px-1.5 py-1 transition-colors z-10"
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="flex-1 min-w-0 sm:ml-2 flex items-center order-3 sm:order-none w-full sm:w-auto basis-full sm:basis-auto">
          <h1 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
            {productName}
          </h1>
        </div>

        <div className="flex items-center gap-1 ml-auto z-10">
          <ProjectShareMenu
            projectCtx={projectCtx}
            projectTitle={productName}
            shareUrlOverride={shareUrl}
            onShared={() => setMenuOpen(false)}
          />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title="More options"
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white transition-colors",
                menuOpen
                  ? "text-slate-700 bg-slate-100"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
              )}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={!canEdit}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left",
                    canEdit
                      ? "text-slate-700 hover:bg-slate-50"
                      : "text-slate-300 cursor-not-allowed",
                  )}
                >
                  <PenLine className="w-3.5 h-3.5 opacity-60" />
                  Rename
                </button>

                <button
                  type="button"
                  onClick={handlePin}
                  disabled={!canEdit}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left",
                    canEdit
                      ? "text-slate-700 hover:bg-slate-50"
                      : "text-slate-300 cursor-not-allowed",
                  )}
                >
                  <Pin className="w-3.5 h-3.5 opacity-60" />
                  Pin project
                </button>

                {canArchive && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                  >
                    <Archive className="w-3.5 h-3.5 opacity-60" />
                    Archive
                  </button>
                )}

                {canDelete && <div className="my-1 border-t border-slate-100" />}

                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 opacity-80" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {renameModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4"
          onClick={() => setRenameModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                  <PenLine className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Rename project</h2>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">New name</label>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter new project name"
                className="w-full h-9 px-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                }}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameSubmit}
                disabled={renameMutation.isPending}
                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-medium text-white transition-colors disabled:opacity-60"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Delete project?</h2>
                <p className="text-xs text-slate-500 mt-1">
                  This will permanently delete{" "}
                  <span className="font-medium text-slate-700">{productName}</span>. This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-medium text-white transition-colors disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
