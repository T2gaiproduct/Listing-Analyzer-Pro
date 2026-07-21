import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Upload, Trash2 } from "lucide-react";
import { defaultFaviconUrl, defaultLogoUrl, resolveBrandingAsset } from "@/lib/branding";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, settings }),
  }).then((r) => r.json());
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function BrandingUploadField({
  label,
  description,
  value,
  fallbackUrl,
  accept,
  maxBytes,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  fallbackUrl: string;
  accept: string;
  maxBytes: number;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const previewUrl = value.trim() ? resolveBrandingAsset(value, fallbackUrl) : fallbackUrl;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > maxBytes) {
      toast({
        title: "File too large",
        description: `Maximum size is ${Math.round(maxBytes / 1024)} KB.`,
        variant: "destructive",
      });
      return;
    }
    try {
      onChange(await readFileAsDataUrl(file));
    } catch {
      toast({ title: "Upload failed", description: "Could not read the selected file.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          <img src={previewUrl} alt="" className="max-w-full max-h-full object-contain" />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          {value.trim() && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPlatform() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    platform_name: "SellerLens",
    support_email: "",
    support_phone: "",
    company_address: "",
    timezone: "UTC",
    default_language: "en",
    max_audits_per_user: "100",
    maintenance_mode: "false",
    site_logo_url: "",
    site_favicon_url: "",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-platform"], queryFn: () => fetchSettings("platform") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("platform", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      qc.invalidateQueries({ queryKey: ["company-contact"] });
      qc.invalidateQueries({ queryKey: ["admin-settings-platform"] });
      toast({ title: "Settings saved" });
    },
  });

  const field = (key: keyof typeof form, label: string, type: string = "text", multiline?: boolean) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      {multiline
        ? <Textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3} />
        : <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      }
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Platform Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Logo and favicon appear on the public site, sign-in pages, and browser tab. Leave empty to use defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {field("platform_name", "Platform Name")}
          <BrandingUploadField
            label="Site Logo"
            description="Recommended: SVG or PNG with transparent background, up to 2 MB."
            value={form.site_logo_url}
            fallbackUrl={defaultLogoUrl()}
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            maxBytes={2 * 1024 * 1024}
            onChange={(site_logo_url) => setForm((f) => ({ ...f, site_logo_url }))}
          />
          <BrandingUploadField
            label="Favicon"
            description="Recommended: square PNG, SVG, or ICO, up to 500 KB."
            value={form.site_favicon_url}
            fallbackUrl={defaultFaviconUrl()}
            accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp"
            maxBytes={500 * 1024}
            onChange={(site_favicon_url) => setForm((f) => ({ ...f, site_favicon_url }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {field("support_email", "Support Email", "email")}
          {field("support_phone", "Support Phone")}
          {field("company_address", "Company Address", "text", true)}
          {field("timezone", "Default Timezone")}
          {field("default_language", "Default Language")}
          {field("max_audits_per_user", "Max Audits Per User", "number")}
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="h-4 w-4 mr-2" />
        {save.isPending ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
