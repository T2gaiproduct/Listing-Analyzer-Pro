import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Save, KeyRound, CheckCircle, AlertCircle, Sparkles } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

function testOpenAIKey(key: string): Promise<{ valid: boolean; error?: string }> {
  return fetch("/api/admin/test-openai-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then((r) => r.json());
}

function testGeminiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  return fetch("/api/admin/test-gemini-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then((r) => r.json());
}

export default function AdminSettingsAI() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    ai_provider: "openai",
    openai_api_key: "",
    openai_base_url: "https://api.openai.com/v1",
    gemini_api_key: "",
  });
  const [openaiTestStatus, setOpenaiTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [geminiTestStatus, setGeminiTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  const { data } = useQuery({ queryKey: ["admin-settings-ai"], queryFn: () => fetchSettings("ai") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("ai", form),
    onSuccess: () => {
      toast({ title: "AI settings saved" });
      setOpenaiTestStatus("idle");
      setGeminiTestStatus("idle");
    },
  });

  const handleTestOpenAI = async () => {
    if (!form.openai_api_key.trim()) {
      toast({ title: "Please enter an OpenAI API key", variant: "destructive" });
      return;
    }
    setOpenaiTestStatus("testing");
    const result = await testOpenAIKey(form.openai_api_key);
    setOpenaiTestStatus(result.valid ? "valid" : "invalid");
    toast({
      title: result.valid ? "OpenAI API key is valid" : "OpenAI API key is invalid",
      variant: result.valid ? "default" : "destructive",
    });
  };

  const handleTestGemini = async () => {
    if (!form.gemini_api_key.trim()) {
      toast({ title: "Please enter a Gemini API key", variant: "destructive" });
      return;
    }
    setGeminiTestStatus("testing");
    const result = await testGeminiKey(form.gemini_api_key);
    setGeminiTestStatus(result.valid ? "valid" : "invalid");
    toast({
      title: result.valid ? "Gemini API key is valid" : "Gemini API key is invalid",
      variant: result.valid ? "default" : "destructive",
    });
  };

  const provider = form.ai_provider ?? "openai";

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">AI Settings</h1>
        </div>

        {/* Provider Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose which AI provider powers all listing analysis, content generation, and image creation.
            </p>
            <div className="flex gap-3">
              <label
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  provider === "openai"
                    ? "border-orange-500 bg-orange-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="ai_provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={(e) => setForm({ ...form, ai_provider: e.target.value })}
                  className="sr-only"
                />
                <div className="font-semibold text-sm">OpenAI</div>
                <div className="text-xs text-muted-foreground mt-1">GPT-4o + DALL-E 3</div>
              </label>
              <label
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  provider === "gemini"
                    ? "border-orange-500 bg-orange-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="ai_provider"
                  value="gemini"
                  checked={provider === "gemini"}
                  onChange={(e) => setForm({ ...form, ai_provider: e.target.value })}
                  className="sr-only"
                />
                <div className="font-semibold text-sm">Google Gemini</div>
                <div className="text-xs text-muted-foreground mt-1">Gemini 2.5 Flash + Image</div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* OpenAI Settings */}
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
                Your OpenAI API key. Used when OpenAI is selected as the provider.
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
                onClick={handleTestOpenAI}
                disabled={openaiTestStatus === "testing" || !form.openai_api_key.trim()}
              >
                {openaiTestStatus === "testing" ? "Testing..." : "Test OpenAI Key"}
              </Button>
              {openaiTestStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {openaiTestStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
          </CardContent>
        </Card>

        {/* Gemini Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Gemini API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">API Key</label>
              <Input
                type="password"
                placeholder="AIza..."
                value={form.gemini_api_key}
                onChange={(e) => setForm({ ...form, gemini_api_key: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Your Google Gemini API key. Get one at Google AI Studio. Used when Gemini is selected.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTestGemini}
                disabled={geminiTestStatus === "testing" || !form.gemini_api_key.trim()}
              >
                {geminiTestStatus === "testing" ? "Testing..." : "Test Gemini Key"}
              </Button>
              {geminiTestStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {geminiTestStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
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
