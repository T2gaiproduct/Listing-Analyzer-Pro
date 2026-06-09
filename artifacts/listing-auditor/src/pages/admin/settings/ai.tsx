import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Save, KeyRound, CheckCircle, AlertCircle } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

function testApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  return fetch("/api/admin/test-openai-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then((r) => r.json());
}

export default function AdminSettingsAI() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    openai_api_key: "",
    openai_base_url: "https://api.openai.com/v1",
  });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  const { data } = useQuery({ queryKey: ["admin-settings-ai"], queryFn: () => fetchSettings("ai") });
  useEffect(() => { if (data) setForm({ ...form, ...data }); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("ai", form),
    onSuccess: () => {
      toast({ title: "AI settings saved" });
      setTestStatus("idle");
    },
  });

  const handleTest = async () => {
    if (!form.openai_api_key.trim()) {
      toast({ title: "Please enter an API key", variant: "destructive" });
      return;
    }
    setTestStatus("testing");
    const result = await testApiKey(form.openai_api_key);
    setTestStatus(result.valid ? "valid" : "invalid");
    toast({
      title: result.valid ? "API key is valid" : "API key is invalid",
      variant: result.valid ? "default" : "destructive",
    });
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">AI Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              OpenAI API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={form.openai_api_key}
                onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Your OpenAI API key. All AI features will use this key instead of Replit integration.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Base URL (optional)</label>
              <Input
                type="text"
                value={form.openai_base_url}
                onChange={(e) => setForm({ ...form, openai_base_url: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Default: https://api.openai.com/v1</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testStatus === "testing" || !form.openai_api_key.trim()}
              >
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </Button>
              {testStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {testStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {save.isPending ? "Saving..." : "Save AI Settings"}
        </Button>
      </div>
    </>
  );
}
