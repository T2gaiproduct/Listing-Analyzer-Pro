import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";
import { Mail, Save, CheckCircle2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const CATEGORY = "email";
const SECRET_FIELDS = new Set(["smtp_password"]);

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

export default function AdminSettingsEmail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email_from_name: "SellerLens",
    email_from_address: "",
    email_reply_to: "",
    email_notifications_enabled: "true",
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
  });
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["admin-settings-email"],
    queryFn: () => fetchSettings(CATEGORY),
  });

  useEffect(() => {
    if (!data) return;
    const masked = new Set<string>();
    const merged = { ...form };
    for (const [key, value] of Object.entries(data)) {
      if (value === "***" && SECRET_FIELDS.has(key)) {
        masked.add(key);
        merged[key as keyof typeof merged] = "";
      } else {
        merged[key as keyof typeof merged] = value;
      }
    }
    setMaskedFields(masked);
    setForm(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await queryClient.invalidateQueries({ queryKey: ["admin-settings-email"] });
      toast({ title: "Email settings saved" });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to save email settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const field = (key: keyof typeof form, label: string, type: string = "text", placeholder?: string) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <Input
        type={type}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Email Settings</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Sender</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("email_from_name", "From Name", "text", "SellerLens")}
            {field("email_from_address", "From Email", "email", "no-reply@yourdomain.com")}
            {field("email_reply_to", "Reply-To Email", "email", "support@yourdomain.com")}
            <p className="text-xs text-muted-foreground">
              The from address must be allowed by your SMTP provider. Use port 587 for STARTTLS or 465 for SSL.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email notifications (SMTP)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send notification emails when credits are low, projects change, and other in-app alerts.
                </p>
              </div>
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm shrink-0"
                value={form.email_notifications_enabled}
                onChange={(e) => setForm({ ...form, email_notifications_enabled: e.target.value })}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>SMTP (Nodemailer)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              All transactional and notification emails are sent through your SMTP server (SendGrid, Gmail, etc.).
            </p>
            {field("smtp_host", "SMTP Host", "text", "smtp.example.com")}
            {field("smtp_port", "SMTP Port", "number", "587")}
            {field("smtp_username", "SMTP Username")}
            <div>
              <label className="text-sm font-medium mb-1 block">SMTP Password</label>
              <Input
                type="password"
                value={form.smtp_password}
                placeholder={maskedFields.has("smtp_password") ? "Value saved — re-enter to update" : "••••••••"}
                onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
              />
              {maskedFields.has("smtp_password") && form.smtp_password === "" && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  A password is saved. Leave blank to keep it, or type a new one to replace it.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </>
  );
}
