import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Save, KeyRound, CheckCircle, AlertCircle, Sparkles, Zap, Shield } from "lucide-react";

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

function testReplitAI(): Promise<{ valid: boolean; error?: string }> {
  return fetch("/api/admin/test-replit-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).then((r) => r.json());
}

const PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI",
    subtitle: "GPT-4o + DALL-E 3",
    icon: "openai",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    subtitle: "Gemini 2.5 Flash + Image",
    icon: "gemini",
  },
  {
    value: "replit",
    label: "Replit AI",
    subtitle: "Replit Agent + Image",
    icon: "replit",
  },
];

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
  const [replitTestStatus, setReplitTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  const { data } = useQuery({ queryKey: ["admin-settings-ai"], queryFn: () => fetchSettings("ai") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("ai", form),
    onSuccess: () => {
      toast({ title: "AI settings saved" });
      setOpenaiTestStatus("idle");
      setGeminiTestStatus("idle");
      setReplitTestStatus("idle");
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

  const handleTestReplit = async () => {
    setReplitTestStatus("testing");
    const result = await testReplitAI();
    setReplitTestStatus(result.valid ? "valid" : "invalid");
    toast({
      title: result.valid ? "Replit AI is connected" : "Replit AI connection failed",
      variant: result.valid ? "default" : "destructive",
    });
  };

  const provider = (form.ai_provider ?? "openai") as "openai" | "gemini" | "replit";

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">AI Settings</h1>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900">
              You can switch providers anytime. Your settings and API keys are saved securely.
            </p>
          </div>
        </div>

        {/* Provider Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5" />
              Select AI Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which AI provider powers all listing analysis, content generation, and image creation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROVIDERS.map((p) => (
                <label
                  key={p.value}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col gap-2 ${
                    provider === p.value
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="ai_provider"
                    value={p.value}
                    checked={provider === p.value}
                    onChange={(e) => setForm({ ...form, ai_provider: e.target.value })}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{p.label}</div>
                    {provider === p.value && (
                      <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white ring-2 ring-orange-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.subtitle}</div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Provider-specific config */}
        {provider === "openai" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Configure OpenAI
                </div>
                {openaiTestStatus === "valid" && (
                  <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" /> Connected
                  </span>
                )}
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
                  Your OpenAI API key. All AI features will use this key when OpenAI is selected.
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
                  {openaiTestStatus === "testing" ? "Testing..." : "Test Connection"}
                </Button>
                {openaiTestStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
                {openaiTestStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
              </div>
            </CardContent>
          </Card>
        )}

        {provider === "gemini" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Configure Google Gemini
                </div>
                {geminiTestStatus === "valid" && (
                  <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" /> Connected
                  </span>
                )}
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
                  Your Google Gemini API key. Get one at{" "}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
                    Google AI Studio
                  </a>
                  . Used when Gemini is selected.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestGemini}
                  disabled={geminiTestStatus === "testing" || !form.gemini_api_key.trim()}
                >
                  {geminiTestStatus === "testing" ? "Testing..." : "Test Connection"}
                </Button>
                {geminiTestStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
                {geminiTestStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
              </div>
            </CardContent>
          </Card>
        )}

        {provider === "replit" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Replit AI
                </div>
                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" /> Always Available
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Replit AI is powered by the Replit AI integration and is available without any API key.
                It uses GPT-5.4 for text generation and GPT-Image-1 for image generation.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestReplit}
                  disabled={replitTestStatus === "testing"}
                >
                  {replitTestStatus === "testing" ? "Testing..." : "Test Connection"}
                </Button>
                {replitTestStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
                {replitTestStatus === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security notice */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Your data is secure</p>
            <p className="text-sm text-amber-800 mt-0.5">
              Your API keys are encrypted and never shared with third parties.
            </p>
          </div>
        </div>

        {/* Save buttons */}
        <div className="flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {save.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setForm({
                ai_provider: "openai",
                openai_api_key: "",
                openai_base_url: "https://api.openai.com/v1",
                gemini_api_key: "",
              });
              toast({ title: "Reset to defaults" });
            }}
          >
            Reset to Default
          </Button>
        </div>
      </div>
    </>
  );
}
