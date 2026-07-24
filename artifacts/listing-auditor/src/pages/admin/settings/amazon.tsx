import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Save, CheckCircle2, Eye, EyeOff, FlaskConical, Link2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const SECRET_FIELDS = new Set(["amazon_sp_client_secret", "amazon_aws_secret_access_key"]);

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ category, settings }),
  }).then((r) => r.json());
}

function testAmazonSp(payload: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandbox: boolean;
}): Promise<{ ok: boolean; message: string }> {
  return fetch(`${basePath}/api/admin/test-amazon-sp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      clientId: payload.clientId.trim(),
      ...(payload.clientSecret.trim() ? { clientSecret: payload.clientSecret.trim() } : {}),
      redirectUri: payload.redirectUri.trim(),
      sandbox: payload.sandbox,
    }),
  }).then(async (r) => {
    const data = await r.json() as { ok: boolean; message: string };
    if (!r.ok) throw new Error(data.message ?? "Test failed");
    return data;
  });
}

function SecretInput({
  label, value, onChange, hasSavedValue, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  hasSavedValue?: boolean; placeholder?: string;
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
          className="pr-10"
          placeholder={hasSavedValue ? "Value saved — re-enter to update" : placeholder}
        />
        <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hasSavedValue && value === "" && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> A value is saved. Leave blank to keep it.
        </p>
      )}
    </div>
  );
}

export default function AdminSettingsAmazon() {
  const { toast } = useToast();
  const defaultRedirect = typeof window !== "undefined"
    ? `${window.location.origin}${basePath}/api/amazon/oauth/callback`
    : `${basePath}/api/amazon/oauth/callback`;

  const [form, setForm] = useState({
    amazon_sp_enabled: "false",
    amazon_sp_sandbox: "true",
    amazon_sp_application_id: "",
    amazon_sp_client_id: "",
    amazon_sp_client_secret: "",
    amazon_sp_redirect_uri: defaultRedirect,
    amazon_sp_default_marketplace: "US",
    amazon_aws_access_key_id: "",
    amazon_aws_secret_access_key: "",
    amazon_aws_role_arn: "",
  });
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings-amazon"],
    queryFn: () => fetchSettings("amazon"),
  });

  useEffect(() => {
    if (!data) return;
    const masked = new Set<string>();
    const next = { ...form };
    for (const [key, value] of Object.entries(data)) {
      if (SECRET_FIELDS.has(key) && value === "***") {
        masked.add(key);
        next[key as keyof typeof form] = "";
      } else if (key in next) {
        next[key as keyof typeof form] = value;
      }
    }
    if (!next.amazon_sp_redirect_uri) {
      next.amazon_sp_redirect_uri = defaultRedirect;
    }
    setMaskedFields(masked);
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveSettings("amazon", form),
    onSuccess: () => toast({ title: "Amazon settings saved" }),
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: async () => {
      if (!form.amazon_sp_client_id.trim()) {
        throw new Error("Enter your LWA Client ID first.");
      }
      if (!form.amazon_sp_client_secret.trim() && !maskedFields.has("amazon_sp_client_secret")) {
        throw new Error("Enter your LWA Client Secret from Amazon Developer Console.");
      }
      return testAmazonSp({
        clientId: form.amazon_sp_client_id,
        clientSecret: form.amazon_sp_client_secret,
        redirectUri: form.amazon_sp_redirect_uri || defaultRedirect,
        sandbox: form.amazon_sp_sandbox === "true",
      });
    },
    onSuccess: (result) => toast({ title: "Connection OK", description: result.message }),
    onError: (err) => toast({
      title: "Connection failed",
      description: err instanceof Error ? err.message : "Test failed",
      variant: "destructive",
    }),
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading Amazon settings…</div>;
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-orange-500" />
          Amazon Settings
        </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure Amazon SP-API for Publish to Amazon. Use sandbox mode for testing before going live.
              Publishing turns on automatically when LWA and AWS credentials are saved.
            </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Feature toggles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Publish to Amazon</p>
              <p className="text-xs text-muted-foreground">Allows sellers to publish listings from Step 5</p>
            </div>
            <Switch
              checked={form.amazon_sp_enabled === "true"}
              onCheckedChange={(v) => set("amazon_sp_enabled")(v ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sandbox mode</p>
              <p className="text-xs text-muted-foreground">Use SP-API sandbox endpoints (recommended for testing)</p>
            </div>
            <Switch
              checked={form.amazon_sp_sandbox === "true"}
              onCheckedChange={(v) => set("amazon_sp_sandbox")(v ? "true" : "false")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Login with Amazon (LWA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">SP-API Application ID</label>
            <Input
              value={form.amazon_sp_application_id}
              onChange={(e) => set("amazon_sp_application_id")(e.target.value)}
              placeholder="amzn1.sp.solution...."
            />
            <p className="text-xs text-muted-foreground mt-1">
              From Develop Apps → your app name (not LWA credentials). Used when sellers click Connect Amazon.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">LWA Client ID</label>
            <Input
              value={form.amazon_sp_client_id}
              onChange={(e) => set("amazon_sp_client_id")(e.target.value)}
              placeholder="amzn1.application-oa2-client...."
            />
          </div>
          <SecretInput
            label="LWA Client Secret"
            value={form.amazon_sp_client_secret}
            onChange={set("amazon_sp_client_secret")}
            hasSavedValue={maskedFields.has("amazon_sp_client_secret")}
            placeholder="amzn1.oa2-cs.v1...."
          />
          <p className="text-xs text-muted-foreground -mt-2">
            Paste only the secret value. Do not include the word &quot;Secret&quot; shown in Seller Central.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">OAuth redirect URI</label>
            <Input
              value={form.amazon_sp_redirect_uri}
              onChange={(e) => set("amazon_sp_redirect_uri")(e.target.value)}
              placeholder={defaultRedirect}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Register this exact URL in your Amazon Developer app.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Default marketplace</label>
            <Input
              value={form.amazon_sp_default_marketplace}
              onChange={(e) => set("amazon_sp_default_marketplace")(e.target.value.toUpperCase())}
              placeholder="US"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AWS signing (SP-API requests)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            From AWS IAM (or SP-API developer registration). These are not the LWA Client ID/Secret or Application ID.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">AWS Access Key ID</label>
            <Input
              value={form.amazon_aws_access_key_id}
              onChange={(e) => set("amazon_aws_access_key_id")(e.target.value)}
              placeholder="AKIA..."
            />
          </div>
          <SecretInput
            label="AWS Secret Access Key"
            value={form.amazon_aws_secret_access_key}
            onChange={set("amazon_aws_secret_access_key")}
            hasSavedValue={maskedFields.has("amazon_aws_secret_access_key")}
            placeholder="40-character IAM secret"
          />
          <div>
            <label className="text-sm font-medium mb-1 block">IAM Role ARN (optional)</label>
            <Input value={form.amazon_aws_role_arn} onChange={(e) => set("amazon_aws_role_arn")(e.target.value)} placeholder="arn:aws:iam::..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          Save settings
        </Button>
        <Button variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending || saveMut.isPending}>
          Test LWA connection
        </Button>
      </div>
    </div>
  );
}
