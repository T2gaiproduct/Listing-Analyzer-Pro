import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";
import { AMAZON_MARKETPLACES } from "@/lib/amazon-export";
import { Store, Save, Eye, EyeOff, CheckCircle2, PlugZap } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const CATEGORY = "amazon";

const SECRET_FIELDS = new Set([
  "amazon_sp_client_secret",
  "amazon_aws_secret_access_key",
]);

const DEFAULT_FORM = {
  amazon_sp_enabled: "true",
  amazon_sp_sandbox: "true",
  amazon_sp_application_id: "",
  amazon_sp_client_id: "",
  amazon_sp_client_secret: "",
  amazon_sp_redirect_uri: "",
  amazon_sp_default_marketplace: "US",
  amazon_aws_access_key_id: "",
  amazon_aws_secret_access_key: "",
  amazon_aws_role_arn: "",
};

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetchJson(`${basePath}/api/admin/settings?category=${encodeURIComponent(category)}`);
}

function saveSettings(category: string, settings: Record<string, string>): Promise<{ success?: boolean }> {
  return fetchJson(`${basePath}/api/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, settings }),
  });
}

function SecretInput({
  label,
  value,
  onChange,
  hasSavedValue,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hasSavedValue?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 font-mono text-xs"
          placeholder={hasSavedValue ? "Saved — re-enter to replace" : placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute right-3 top-2.5 text-muted-foreground"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hasSavedValue && value === "" ? (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Stored securely. Leave blank to keep the current value.
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}

export default function AdminSettingsAmazonSpApi() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings-amazon"],
    queryFn: () => fetchSettings(CATEGORY),
  });

  useEffect(() => {
    if (!data) return;
    const masked = new Set<string>();
    const merged = { ...DEFAULT_FORM };
    for (const [key, value] of Object.entries(data)) {
      if (!(key in merged)) continue;
      if (value === "***") {
        masked.add(key);
        merged[key as keyof typeof merged] = "";
      } else {
        merged[key as keyof typeof merged] = value;
      }
    }
    setMaskedFields(masked);
    setForm(merged);
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const settingsToSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value === "" && maskedFields.has(key)) continue;
        settingsToSave[key] = value;
      }
      return saveSettings(CATEGORY, settingsToSave);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-settings-amazon"] });
      toast({ title: "Amazon SP-API settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const testConnection = useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean; message: string }>(`${basePath}/api/admin/settings/test-amazon-sp`, {
        method: "POST",
      }),
    onSuccess: (result) => {
      toast({
        title: result.ok ? "LWA credentials valid" : "Connection test failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const oauthCallbackExample =
    typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/api/amazon/oauth/callback`
      : "https://sellerlens.io/api/amazon/oauth/callback";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Store className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">Amazon SP-API</h1>
          <p className="text-sm text-muted-foreground">
            Platform app credentials for seller OAuth. Sellers only click Connect with Amazon on Marketplaces.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Enable Amazon and choose sandbox or production SP-API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.amazon_sp_enabled === "true"}
              onChange={(e) => setForm({ ...form, amazon_sp_enabled: e.target.checked ? "true" : "false" })}
            />
            Amazon integration enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.amazon_sp_sandbox === "true"}
              onChange={(e) => setForm({ ...form, amazon_sp_sandbox: e.target.checked ? "true" : "false" })}
            />
            Use SP-API sandbox
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LWA application (SellerLens app)</CardTitle>
          <CardDescription>
            From Seller Central → Apps &amp; Services → Develop Apps → your SellerLens app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Application ID</label>
            <Input
              value={form.amazon_sp_application_id}
              onChange={(e) => setForm({ ...form, amazon_sp_application_id: e.target.value })}
              placeholder="amzn1.sp.solution...."
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">LWA Client ID</label>
            <Input
              value={form.amazon_sp_client_id}
              onChange={(e) => setForm({ ...form, amazon_sp_client_id: e.target.value })}
              placeholder="amzn1.application-oa2-client...."
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
          <SecretInput
            label="LWA Client secret"
            value={form.amazon_sp_client_secret}
            onChange={(v) => setForm({ ...form, amazon_sp_client_secret: v })}
            hasSavedValue={maskedFields.has("amazon_sp_client_secret")}
            placeholder="amzn1.oa2-cs.v1...."
          />
          <div>
            <label className="text-sm font-medium mb-1 block">OAuth redirect URI</label>
            <Input
              value={form.amazon_sp_redirect_uri}
              onChange={(e) => setForm({ ...form, amazon_sp_redirect_uri: e.target.value })}
              placeholder={oauthCallbackExample}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Register this exact URL in your Amazon app. Example for this host:{" "}
              <code className="text-[11px]">{oauthCallbackExample}</code>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Default marketplace</label>
            <select
              value={form.amazon_sp_default_marketplace}
              onChange={(e) => setForm({ ...form, amazon_sp_default_marketplace: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              {AMAZON_MARKETPLACES.map((marketplace) => (
                <option key={marketplace.id} value={marketplace.id}>
                  {marketplace.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AWS IAM (publish &amp; sync)</CardTitle>
          <CardDescription>
            Required for listing publish and order sync. OAuth seller connect works without these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">AWS Access Key ID</label>
            <Input
              value={form.amazon_aws_access_key_id}
              onChange={(e) => setForm({ ...form, amazon_aws_access_key_id: e.target.value })}
              placeholder="AKIA..."
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
          <SecretInput
            label="AWS Secret Access Key"
            value={form.amazon_aws_secret_access_key}
            onChange={(v) => setForm({ ...form, amazon_aws_secret_access_key: v })}
            hasSavedValue={maskedFields.has("amazon_aws_secret_access_key")}
          />
          <div>
            <label className="text-sm font-medium mb-1 block">AWS Role ARN (optional)</label>
            <Input
              value={form.amazon_aws_role_arn}
              onChange={(e) => setForm({ ...form, amazon_aws_role_arn: e.target.value })}
              placeholder="arn:aws:iam::..."
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          {save.isPending ? "Saving…" : "Save Amazon settings"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => testConnection.mutate()}
          disabled={testConnection.isPending || save.isPending}
        >
          <PlugZap className="h-4 w-4 mr-2" />
          {testConnection.isPending ? "Testing…" : "Test LWA credentials"}
        </Button>
      </div>
    </div>
  );
}
