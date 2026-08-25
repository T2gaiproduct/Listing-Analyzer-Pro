import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadMemoryFileDialog } from "@/components/upload-memory-file-dialog";
import { titleFromMemoryFilename } from "@/lib/sellermate-memory-upload";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type DefaultAgentMemoryFile = {
  id: string;
  name: string;
  description: string;
  content: string;
  memoryType: string;
};

async function fetchDefaultAgentMemory(slug: string): Promise<DefaultAgentMemoryFile[]> {
  const endpoints = [
    `${basePath}/api/admin/sellermate/default-agents/${encodeURIComponent(slug)}/memory`,
    `${basePath}/api/admin/settings?category=sellermate_default_agent_memory&slug=${encodeURIComponent(slug)}`,
  ];

  let lastError = "Failed to load memory files.";
  for (const url of endpoints) {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 404) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      lastError = data.error ?? lastError;
      continue;
    }
    const data = await res.json().catch(() => ({})) as { memory?: DefaultAgentMemoryFile[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? lastError);
    }
    return data.memory ?? [];
  }
  throw new Error(lastError);
}

async function uploadDefaultAgentMemory(
  slug: string,
  input: { name: string; description?: string; filename: string; fileBase64: string },
): Promise<DefaultAgentMemoryFile> {
  const dedicated = await fetch(
    `${basePath}/api/admin/sellermate/default-agents/${encodeURIComponent(slug)}/memory/upload`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (dedicated.status !== 404) {
    const data = await dedicated.json().catch(() => ({})) as { memory?: DefaultAgentMemoryFile; error?: string };
    if (!dedicated.ok) {
      throw new Error(data.error ?? "Failed to upload memory file.");
    }
    if (!data.memory) throw new Error("Failed to upload memory file.");
    return data.memory;
  }

  const res = await fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "sellermate_default_agent_memory",
      action: "upload",
      slug,
      ...input,
    }),
  });
  const data = await res.json().catch(() => ({})) as { memory?: DefaultAgentMemoryFile; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to upload memory file.");
  }
  if (!data.memory) throw new Error("Failed to upload memory file.");
  return data.memory;
}

async function deleteDefaultAgentMemory(slug: string, memoryId: string): Promise<void> {
  const dedicated = await fetch(
    `${basePath}/api/admin/sellermate/default-agents/${encodeURIComponent(slug)}/memory/${encodeURIComponent(memoryId)}`,
    { method: "DELETE", credentials: "include" },
  );

  if (dedicated.status !== 404) {
    if (!dedicated.ok) {
      const data = await dedicated.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Failed to delete memory file.");
    }
    return;
  }

  const res = await fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "sellermate_default_agent_memory",
      action: "delete",
      slug,
      memoryId,
    }),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Failed to delete memory file.");
  }
}

export function DefaultAgentMemorySection({ slug }: { slug: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const memoryQuery = useQuery({
    queryKey: ["admin-default-agent-memory", slug],
    queryFn: () => fetchDefaultAgentMemory(slug),
  });

  const upload = useMutation({
    mutationFn: (input: { name: string; description?: string; filename: string; fileBase64: string }) =>
      uploadDefaultAgentMemory(slug, input),
    onSuccess: (memory) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-default-agent-memory", slug] });
      setUploadOpen(false);
      toast({ title: "Memory uploaded", description: `${memory.name} synced to all workspaces.` });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (memoryId: string) => deleteDefaultAgentMemory(slug, memoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-default-agent-memory", slug] });
      toast({ title: "Memory removed", description: "Removed from all workspaces." });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const files = memoryQuery.data ?? [];

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Shared memory files</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Upload
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        These files are pushed to every seller workspace for this default agent. Sellers can use them but cannot edit them.
      </p>

      {memoryQuery.isLoading && (
        <p className="text-xs text-slate-400">Loading memory files…</p>
      )}

      {memoryQuery.isError && (
        <p className="text-xs text-red-600">
          {memoryQuery.error instanceof Error ? memoryQuery.error.message : "Failed to load memory files."}
        </p>
      )}

      {files.length === 0 && !memoryQuery.isLoading && !memoryQuery.isError ? (
        <p className="text-xs text-slate-400">No shared memory files yet.</p>
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="flex items-start gap-2 rounded-md border border-slate-100 px-2 py-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400 line-clamp-2">
                  {file.description?.trim() || `${file.content.length.toLocaleString()} characters`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-red-600"
                onClick={() => remove.mutate(file.id)}
                disabled={remove.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <UploadMemoryFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isUploading={upload.isPending}
        onUpload={async (input) => {
          await upload.mutateAsync({
            ...input,
            name: input.name || titleFromMemoryFilename(input.filename),
          });
        }}
      />
    </div>
  );
}
