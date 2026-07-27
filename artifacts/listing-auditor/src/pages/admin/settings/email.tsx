import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Save } from "lucide-react";

const CATEGORY = "email";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ category, settings }),
  }).then((r) => r.json());
}

export default function AdminSettingsEmail() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    email_from_name: "SellerLens",
    email_from_address: "",
    email_reply_to: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-email"], queryFn: () => fetchSettings(CATEGORY) });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings(CATEGORY, form),
    onSuccess: () => toast({ title: "Email settings saved" }),
    onError: () => toast({ title: "Failed to save email settings", variant: "destructive" }),
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
          <CardHeader>
            <CardTitle>Sender</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle>SMTP (Nodemailer)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("smtp_host", "SMTP Host", "text", "smtp.example.com")}
            {field("smtp_port", "SMTP Port", "number", "587")}
            {field("smtp_username", "SMTP Username")}
            {field("smtp_password", "SMTP Password", "password")}
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </>
  );
}
