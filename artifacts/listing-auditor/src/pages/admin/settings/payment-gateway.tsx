import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

function SecretInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" placeholder="sk_..." />
        <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettingsPaymentGateway() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    stripe_enabled: "false", stripe_publishable_key: "", stripe_secret_key: "", stripe_webhook_secret: "", stripe_mode: "test",
    razorpay_enabled: "false", razorpay_key_id: "", razorpay_key_secret: "", razorpay_webhook_secret: "",
    paypal_enabled: "false", paypal_client_id: "", paypal_client_secret: "", paypal_mode: "sandbox",
    default_currency: "USD", default_gateway: "stripe",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-gateway"], queryFn: () => fetchSettings("payment_gateway") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("payment_gateway", form),
    onSuccess: () => toast({ title: "Payment gateway settings saved" }),
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const GatewayBadge = ({ enabled }: { enabled: boolean }) =>
    enabled ? <Badge className="ml-2"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge> : <Badge variant="secondary" className="ml-2">Disabled</Badge>;

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Payment Gateway</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Default Currency</label>
              <select value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                {["USD", "EUR", "GBP", "INR", "CAD", "AUD"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Default Gateway</label>
              <select value={form.default_gateway} onChange={(e) => setForm({ ...form, default_gateway: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="stripe">Stripe</option>
                <option value="razorpay">Razorpay</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="stripe">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stripe">Stripe<GatewayBadge enabled={form.stripe_enabled === "true"} /></TabsTrigger>
            <TabsTrigger value="razorpay">Razorpay<GatewayBadge enabled={form.razorpay_enabled === "true"} /></TabsTrigger>
            <TabsTrigger value="paypal">PayPal<GatewayBadge enabled={form.paypal_enabled === "true"} /></TabsTrigger>
          </TabsList>

          <TabsContent value="stripe">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Stripe Configuration</CardTitle>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={form.stripe_enabled === "true"} onChange={(e) => setForm({ ...form, stripe_enabled: String(e.target.checked) })} />
                  Enable Stripe
                </label>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Mode</label>
                  <select value={form.stripe_mode} onChange={(e) => setForm({ ...form, stripe_mode: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Publishable Key</label>
                  <Input value={form.stripe_publishable_key} onChange={(e) => setForm({ ...form, stripe_publishable_key: e.target.value })} placeholder="pk_test_..." />
                </div>
                <SecretInput label="Secret Key" value={form.stripe_secret_key} onChange={set("stripe_secret_key")} />
                <SecretInput label="Webhook Secret" value={form.stripe_webhook_secret} onChange={set("stripe_webhook_secret")} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="razorpay">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Razorpay Configuration</CardTitle>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={form.razorpay_enabled === "true"} onChange={(e) => setForm({ ...form, razorpay_enabled: String(e.target.checked) })} />
                  Enable Razorpay
                </label>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Key ID</label>
                  <Input value={form.razorpay_key_id} onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder="rzp_test_..." />
                </div>
                <SecretInput label="Key Secret" value={form.razorpay_key_secret} onChange={set("razorpay_key_secret")} />
                <SecretInput label="Webhook Secret" value={form.razorpay_webhook_secret} onChange={set("razorpay_webhook_secret")} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paypal">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>PayPal Configuration</CardTitle>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={form.paypal_enabled === "true"} onChange={(e) => setForm({ ...form, paypal_enabled: String(e.target.checked) })} />
                  Enable PayPal
                </label>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Mode</label>
                  <select value={form.paypal_mode} onChange={(e) => setForm({ ...form, paypal_mode: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Client ID</label>
                  <Input value={form.paypal_client_id} onChange={(e) => setForm({ ...form, paypal_client_id: e.target.value })} />
                </div>
                <SecretInput label="Client Secret" value={form.paypal_client_secret} onChange={set("paypal_client_secret")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Gateway Settings"}</Button>
      </div>
    </>
  );
}
