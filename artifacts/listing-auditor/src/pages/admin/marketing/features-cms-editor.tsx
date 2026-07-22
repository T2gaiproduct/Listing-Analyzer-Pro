import { useRef, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { HOMEPAGE_CMS_DEFAULTS, resolveCmsAssetUrl } from "@/lib/homepage-cms";
import { featureItemKeys, FEATURE_BULLETS_PER_ITEM, MAX_FEATURE_ITEMS } from "@/lib/features-cms";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FeaturesCmsEditorProps {
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}

function placeholder(key: string): string {
  return HOMEPAGE_CMS_DEFAULTS[key] ?? "";
}

async function uploadFeatureImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const payload = JSON.stringify({
    dataUrl,
    filename: file.name,
    folder: "features",
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

function FeatureImageField({
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
      const url = await uploadFeatureImage(file);
      onImageChange(url);
      toast({ title: "Feature mockup uploaded" });
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

  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-500">Card mockup image (optional)</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !uploading) inputRef.current?.click(); }}
        className={cn(
          "rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center cursor-pointer hover:border-orange-300 transition-colors",
          uploading && "opacity-60 cursor-wait",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Feature mockup preview" className="mx-auto max-h-28 rounded object-contain" />
        ) : (
          <div className="py-4 text-slate-400">
            <ImagePlus className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs">Leave empty to use the built-in preview graphic</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="w-3.5 h-3.5 mr-1" />
          {uploading ? "Uploading…" : previewUrl ? "Replace" : "Upload"}
        </Button>
        {imageUrl && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-slate-500" disabled={uploading} onClick={() => onImageChange("")}>
            Remove
          </Button>
        )}
      </div>
      <Input
        className="h-8 text-xs"
        value={imageUrl}
        onChange={(e) => onImageChange(e.target.value)}
        placeholder="/api/images/... or https://..."
      />
    </div>
  );
}

export function FeaturesCmsEditor({ data, onChange }: FeaturesCmsEditorProps) {
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section header</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Heading and subheading shown above the feature cards on the homepage.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-slate-500">Eyebrow (mobile)</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={data["features.eyebrow"] ?? ""}
              placeholder={placeholder("features.eyebrow")}
              onChange={(e) => onChange("features.eyebrow", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Section heading</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={data["features.heading"] ?? ""}
              placeholder={placeholder("features.heading")}
              onChange={(e) => onChange("features.heading", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Section subheading</Label>
            <Textarea
              className="mt-1 text-sm resize-none"
              rows={2}
              value={data["features.subheading"] ?? ""}
              placeholder={placeholder("features.subheading")}
              onChange={(e) => onChange("features.subheading", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Footer tagline</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={data["features.footer_text"] ?? ""}
              placeholder={placeholder("features.footer_text")}
              onChange={(e) => onChange("features.footer_text", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Feature cards</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Up to {MAX_FEATURE_ITEMS} features. Each card needs a title to appear on the homepage. Click Save Changes when done.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: MAX_FEATURE_ITEMS }, (_, i) => i + 1).map((index) => {
            const keys = featureItemKeys(index);
            const title = data[keys.title] ?? "";

            return (
              <Card key={index} className="border border-slate-200 shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-slate-800">
                    Feature {String(index).padStart(2, "0")}
                    {title ? ` — ${title}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={title}
                      placeholder={placeholder(keys.title)}
                      onChange={(e) => onChange(keys.title, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Textarea
                      className="mt-1 text-sm resize-none"
                      rows={2}
                      value={data[keys.desc] ?? ""}
                      placeholder={placeholder(keys.desc)}
                      onChange={(e) => onChange(keys.desc, e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Array.from({ length: FEATURE_BULLETS_PER_ITEM }, (_, bi) => bi + 1).map((bi) => {
                      const bulletKey = keys[`bullet${bi}` as keyof typeof keys];
                      return (
                        <div key={bulletKey}>
                          <Label className="text-xs text-slate-500">Bullet {bi}</Label>
                          <Input
                            className="mt-1 h-8 text-sm"
                            value={data[bulletKey] ?? ""}
                            placeholder={placeholder(bulletKey)}
                            onChange={(e) => onChange(bulletKey, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Link URL</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={data[keys.href] ?? ""}
                      placeholder={placeholder(keys.href)}
                      onChange={(e) => onChange(keys.href, e.target.value)}
                    />
                  </div>
                  <FeatureImageField
                    imageUrl={data[keys.image] ?? ""}
                    onImageChange={(url) => onChange(keys.image, url)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
