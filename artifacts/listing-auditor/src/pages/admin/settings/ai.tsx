import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    ai_model: "gpt-4o-mini", ai_temperature: "0.7", ai_max_tokens: "2000",
    ai_monthly_spend_limit: "100", ai_credits_per_audit: "10",
    ai_system_prompt: "You are an expert Amazon listing optimizer.",
    ai_image_model: "dall-e-3", ai_images_per_generation: "3",
    openai_api_key: "", openai_base_url: "https://api.openai.com/v1",
  });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  const { data } = useQuery({ queryKey: ["admin-settings-ai"], queryFn: () => fetchSettings("ai") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

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
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />OpenAI API Key</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={form.openai_api_key}
                onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Your OpenAI API key. All AI features will use this key instead of Replit integration.</p>
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
              <Button variant="outline" onClick={handleTest} disabled={testStatus === "testing" || !form.openai_api_key.trim()}>
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </Button>
              {testStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {testStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Language Model</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Model</label>
              <Select value={form.ai_model} onValueChange={(v) => setForm({ ...form, ai_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Temperature ({form.ai_temperature})</label>
              <Input type="number" min="0" max="2" step="0.1" value={form.ai_temperature} onChange={(e) => setForm({ ...form, ai_temperature: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Tokens</label>
              <Input type="number" value={form.ai_max_tokens} onChange={(e) => setForm({ ...form, ai_max_tokens: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">System Prompt</label>
              <Textarea rows={4} value={form.ai_system_prompt} onChange={(e) => setForm({ ...form, ai_system_prompt: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Usage Limits & Credits</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Monthly Spend Limit ($)</label>
              <Input type="number" value={form.ai_monthly_spend_limit} onChange={(e) => setForm({ ...form, ai_monthly_spend_limit: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">AI Credits Per Audit</label>
              <Input type="number" value={form.ai_credits_per_audit} onChange={(e) => setForm({ ...form, ai_credits_per_audit: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Image Generation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Image Model</label>
              <Select value={form.ai_image_model} onValueChange={(v) => setForm({ ...form, ai_image_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dall-e-3">DALL·E 3</SelectItem>
                  <SelectItem value="dall-e-2">DALL·E 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Images Per Generation</label>
              <Input type="number" min="1" max="10" value={form.ai_images_per_generation} onChange={(e) => setForm({ ...form, ai_images_per_generation: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save AI Settings"}</Button>
      </div>
    </>
  );
}
