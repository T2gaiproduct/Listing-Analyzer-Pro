import { useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { resolveCmsAssetUrl } from "@/lib/homepage-cms";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PORTFOLIO_ITEM_COUNT = 8;

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
  const res = await fetch(`${basePath}/api/admin/portfolio-image`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      filename: file.name,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json.url as string;
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
    if (!file || !file.type.startsWith("image/")) return;
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
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-500">Image</Label>
      {previewUrl && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 max-w-[200px]">
          <img src={previewUrl} alt="" className="w-full h-auto rounded-md object-contain max-h-32" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 text-sm flex-1 min-w-[180px]"
          value={imageUrl}
          onChange={(e) => onImageChange(e.target.value)}
          placeholder="/portfolio/example.png or upload"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            "Uploading..."
          ) : (
            <>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload
            </>
          )}
        </Button>
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <ImageIcon className="w-3 h-3" />
        Upload a JPG, PNG, or WebP (max 5MB). Required for the tile to appear on the homepage.
      </p>
    </div>
  );
}

export function PortfolioCmsEditor({ data, onChange }: PortfolioCmsEditorProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700">Portfolio items</CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Upload an image for each tile. Items need both a title and image to show on the homepage.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: PORTFOLIO_ITEM_COUNT }, (_, i) => i + 1).map((index) => {
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
                <PortfolioImageField
                  imageUrl={data[imageKey] ?? ""}
                  onImageChange={(url) => onChange(imageKey, url)}
                />
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
