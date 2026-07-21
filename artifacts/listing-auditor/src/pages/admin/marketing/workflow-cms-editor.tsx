import { useRef, useState } from "react";
import { Upload, ImageIcon, ImagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkflowCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

async function uploadWorkflowImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const payload = JSON.stringify({
    dataUrl,
    filename: file.name,
    folder: "workflow",
  });

  const endpoints = [
    `${basePath}/api/admin/workflow-image`,
    `${basePath}/api/admin/hero-image`,
  ];

  let lastError = "Upload failed";

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const json = await res.json().catch(() => ({} as { error?: string; url?: string }));
    if (res.ok && json.url) return json.url as string;

    lastError = json.error || `Upload failed (HTTP ${res.status})`;
    if (res.status !== 404) break;
  }

  throw new Error(lastError);
}

function WorkflowImageField({
  label,
  imageUrl,
  onImageChange,
}: {
  label: string;
  imageUrl: string;
  onImageChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const previewUrl = imageUrl ? resolveCmsAssetUrl(imageUrl, basePath) : "";

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadWorkflowImage(file);
      onImageChange(url);
      toast({ title: "Workflow image uploaded" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs text-slate-500">{label}</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) openFilePicker();
          }
        }}
        onClick={() => {
          if (!uploading) openFilePicker();
        }}
        className={cn(
          "w-full rounded-xl border-2 border-dashed transition-colors text-left cursor-pointer",
          "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/40",
          uploading && "opacity-60 cursor-wait",
        )}
      >
        {previewUrl ? (
          <div className="p-3 space-y-3">
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-40">
              <img src={previewUrl} alt="" className="w-full h-auto max-h-40 object-contain" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
                size="sm"
                disabled={uploading}
                onClick={openFilePicker}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                {uploading ? "Uploading..." : "Replace image"}
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={uploading}
                  onClick={() => onImageChange("")}
                >
                  Remove image
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? "Uploading..." : "Click to upload image"}
            </p>
            <p className="text-xs text-slate-500">JPG, PNG, or WebP — max 5MB</p>
            <Button
              type="button"
              className="bg-orange-500 hover:bg-orange-600 mt-1"
              size="sm"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Choose image
            </Button>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs text-slate-500">Image URL (optional)</Label>
        <Input
          className="mt-1 h-8 text-sm w-full"
          value={imageUrl}
          onChange={(e) => onImageChange(e.target.value)}
          placeholder="/api/images/workflow/... or https://..."
        />
      </div>
    </div>
  );
}

export function WorkflowCmsEditor({ data, onChange }: WorkflowCmsEditorProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700">Before &amp; After images</CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Upload comparison images for the workflow section. Save changes after uploading.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorkflowImageField
          label="Before image"
          imageUrl={data["workflow.before_image"] ?? ""}
          onImageChange={(url) => onChange("workflow.before_image", url)}
        />
        <WorkflowImageField
          label="After image"
          imageUrl={data["workflow.after_image"] ?? ""}
          onImageChange={(url) => onChange("workflow.after_image", url)}
        />
      </CardContent>
      <CardContent className="pt-0">
        <p className="text-[11px] text-slate-400 flex items-start gap-1">
          <ImageIcon className="w-3 h-3 mt-0.5 shrink-0" />
          Images appear in the before/after cards on the homepage workflow section.
        </p>
      </CardContent>
    </Card>
  );
}
