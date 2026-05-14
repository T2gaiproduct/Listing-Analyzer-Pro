import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Copy, ImageIcon, Film, FolderOpen, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MediaFile {
  id: number;
  filename: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  folder: string;
  alt: string | null;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AdminMarketingMedia() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: files = [], isLoading } = useQuery<MediaFile[]>({
    queryKey: ["admin-media", folder, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (folder !== "all") params.set("folder", folder);
      if (search) params.set("q", search);
      return fetch(`${basePath}/api/admin/media?${params}`, { credentials: "include" }).then((r) => r.json());
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const results = [];
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((res) => { reader.onload = (e) => res(e.target?.result as string); reader.readAsDataURL(file); });
        const r = await fetch(`${basePath}/api/admin/media`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, url: dataUrl, mimeType: file.type, size: file.size, folder: folder !== "all" ? folder : "general" }),
        });
        results.push(await r.json());
      }
      return results;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-media"] }); toast({ title: "Files uploaded" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/media/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-media"] }); toast({ title: "File deleted" }); },
  });

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied" });
  }

  const isImage = (f: MediaFile) => f.mimeType?.startsWith("image/") || f.url.startsWith("data:image");
  const folders = ["all", "general", "blog", "heroes", "icons", "banners"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-orange-500" /> Media Library
          </h1>
          <p className="text-slate-500 text-sm mt-1">{files.length} files</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e) => e.target.files && uploadMutation.mutate(e.target.files)} />
          <Button className="bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            <Upload className="w-4 h-4 mr-2" /> {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {folders.map((f) => <SelectItem key={f} value={f} className="capitalize">{f === "all" ? "All Folders" : f}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex border border-slate-200 rounded overflow-hidden">
          <button className={`px-2.5 py-1 text-xs ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setView("grid")}>Grid</button>
          <button className={`px-2.5 py-1 text-xs ${view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-orange-300 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files && uploadMutation.mutate(e.dataTransfer.files); }}
      >
        <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Drag & drop files here or <span className="text-orange-500 font-medium">click to browse</span></p>
        <p className="text-xs text-slate-300 mt-1">Images and videos supported</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No files yet. Upload your first image or video.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {files.map((file) => (
            <div key={file.id} className="group relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {isImage(file) ? (
                <img src={file.url} alt={file.alt ?? file.filename} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-slate-400" /></div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <p className="text-white text-xs font-medium truncate px-2 max-w-full">{file.filename}</p>
                <div className="flex gap-1.5">
                  <button className="bg-white/20 hover:bg-white/30 text-white rounded p-1.5" onClick={() => copyUrl(file.url)} title="Copy URL"><Copy className="w-3.5 h-3.5" /></button>
                  <button className="bg-red-500/80 hover:bg-red-500 text-white rounded p-1.5" onClick={() => confirm("Delete file?") && deleteMutation.mutate(file.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <Badge className="absolute top-1.5 left-1.5 text-xs bg-black/40 text-white hover:bg-black/40 capitalize">{file.folder}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">File</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Folder</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Size</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-slate-50 hover:bg-orange-50/30">
                    <td className="px-4 py-2.5 flex items-center gap-3">
                      {isImage(file) ? <img src={file.url} alt="" className="w-10 h-10 rounded object-cover border border-slate-200" /> : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Film className="w-5 h-5 text-slate-400" /></div>}
                      <div><p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{file.filename}</p><p className="text-xs text-slate-400">{file.mimeType}</p></div>
                    </td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className="text-xs capitalize">{file.folder}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{file.size ? formatBytes(file.size) : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{format(new Date(file.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyUrl(file.url)} title="Copy URL"><Copy className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm("Delete file?") && deleteMutation.mutate(file.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
