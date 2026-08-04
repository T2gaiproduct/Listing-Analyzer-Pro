import { useRef, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function uploadBlogImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const payload = JSON.stringify({
    dataUrl,
    filename: file.name,
    folder: "blog",
  });

  const endpoints = [
    `${basePath}/api/admin/blog-image`,
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

    const json = await res.json().catch(() => ({} as { error?: string }));
    if (res.ok && json.url) return json.url as string;

    lastError = json.error || `Upload failed (HTTP ${res.status})`;
    if (res.status !== 404) break;
  }

  throw new Error(lastError);
}

export function BlogFeaturedImageField({
  imageUrl,
  onImageChange,
}: {
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      onImageChange(url);
      toast({ title: "Featured image uploaded" });
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
              <img src={previewUrl} alt="Featured preview" className="w-full h-auto max-h-40 object-cover" />
            </div>
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 w-full"
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
                  className="w-full"
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
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? "Uploading..." : "Click to upload featured image"}
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
              Upload image
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-snug">
        Save the post after uploading. Shown on the blog index and article header.
      </p>
    </div>
  );
}
