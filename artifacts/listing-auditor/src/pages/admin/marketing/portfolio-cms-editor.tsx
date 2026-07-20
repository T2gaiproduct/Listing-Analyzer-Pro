import { useRef, useState, useEffect } from "react";
import { Plus, Upload, ImageIcon, ImagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { MAX_PORTFOLIO_ITEMS, visiblePortfolioItemCount } from "@/lib/portfolio-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FIT_OPTIONS = [
  { value: "cover", label: "Cover (fill tile)" },
  { value: "contain", label: "Contain (show full image)" },
];

interface PortfolioCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

async function uploadPortfolioImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const payload = JSON.stringify({
    dataUrl,
    filename: file.name,
    folder: "portfolio",
  });

  const endpoints = [
    `${basePath}/api/admin/hero-image`,
    `${basePath}/api/admin/portfolio-image`,
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

function PortfolioImageField({
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
    setUploading(true);
    try {
      const url = await uploadPortfolioImage(file);
      onImageChange(url);
      toast({ title: "Portfolio image uploaded" });
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
    <div className="space-y-3 pt-1 border-t border-slate-100">
      <Label className="text-xs text-slate-500">Portfolio image</Label>

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
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-48">
              <img src={previewUrl} alt="" className="w-full h-auto max-h-48 object-contain" />
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
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? "Uploading..." : "Click to add portfolio image"}
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
          placeholder="/portfolio/example.png or /api/images/portfolio/..."
        />
      </div>

      <p className="text-[11px] text-slate-400 flex items-start gap-1">
        <ImageIcon className="w-3 h-3 mt-0.5 shrink-0" />
        Required for the tile to appear on the homepage. Save changes after uploading.
      </p>
    </div>
  );
}

export function PortfolioCmsEditor({ data, onChange }: PortfolioCmsEditorProps) {
  const [visibleCount, setVisibleCount] = useState(() => visiblePortfolioItemCount(data));

  useEffect(() => {
    setVisibleCount((count) => Math.max(count, visiblePortfolioItemCount(data)));
  }, [data]);

  function addPortfolioItem() {
    if (visibleCount >= MAX_PORTFOLIO_ITEMS) return;
    setVisibleCount((count) => count + 1);
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-700">Portfolio items</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Upload an image for each tile. Items need both a title and image to show on the homepage.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 shrink-0"
          disabled={visibleCount >= MAX_PORTFOLIO_ITEMS}
          onClick={addPortfolioItem}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add item
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: visibleCount }, (_, i) => i + 1).map((index) => {
          const titleKey = `portfolio.item${index}_title`;
          const brandKey = `portfolio.item${index}_brand`;
          const badgeKey = `portfolio.item${index}_badge`;
          const imageKey = `portfolio.item${index}_image`;
          const fitKey = `portfolio.item${index}_fit`;

          return (
            <Card key={index} className="border border-slate-200 shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-slate-800">
                  Item {index}
                  {data[titleKey] ? ` — ${data[titleKey]}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <PortfolioImageField
                  imageUrl={data[imageKey] ?? ""}
                  onImageChange={(url) => onChange(imageKey, url)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[titleKey] ?? ""}
                      onChange={(e) => onChange(titleKey, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Brand</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[brandKey] ?? ""}
                      onChange={(e) => onChange(brandKey, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Badge (optional)</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[badgeKey] ?? ""}
                      onChange={(e) => onChange(badgeKey, e.target.value)}
                      placeholder="NEW"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Image fit</Label>
                    <select
                      className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={data[fitKey] ?? "cover"}
                      onChange={(e) => onChange(fitKey, e.target.value)}
                    >
                      {FIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
