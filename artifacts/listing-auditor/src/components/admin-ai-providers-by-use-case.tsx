import { useMemo, useState } from "react";
import { Plus, Trash2, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AI_USE_CASES,
  AI_USE_CASE_LABELS,
  type AiUseCase,
  type CustomAiProviderForm,
  customProviderApiKeySettingKey,
  parseProvidersJson,
  parseRoutingJson,
  slugifyProviderId,
} from "@/lib/ai-settings-use-cases";

const BUILTIN_ROUTE_OPTIONS = [
  { value: "default", label: "Use global default" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "claude", label: "Anthropic Claude" },
  { value: "replit", label: "Replit AI" },
] as const;

type AdminAiProvidersByUseCaseProps = {
  providers: CustomAiProviderForm[];
  onProvidersChange: (next: CustomAiProviderForm[]) => void;
  routing: Partial<Record<AiUseCase, string>>;
  onRoutingChange: (next: Partial<Record<AiUseCase, string>>) => void;
};

function emptyProvider(): CustomAiProviderForm {
  return {
    id: "",
    label: "",
    baseUrl: "https://api.openai.com/v1",
    chatModel: "gpt-4o",
    imageModel: "",
    useCases: [],
    apiKey: "",
  };
}

export function AdminAiProvidersByUseCase({
  providers,
  onProvidersChange,
  routing,
  onRoutingChange,
}: AdminAiProvidersByUseCaseProps) {
  const [draft, setDraft] = useState<CustomAiProviderForm | null>(null);

  const routeOptions = useMemo(() => {
    const custom = providers.map((p) => ({
      value: `custom:${p.id}`,
      label: `${p.label} (custom)`,
    }));
    return [...BUILTIN_ROUTE_OPTIONS, ...custom];
  }, [providers]);

  const addProvider = () => {
    if (!draft?.label.trim() || !draft.baseUrl.trim() || !draft.chatModel.trim()) return;
    const id = draft.id.trim() || slugifyProviderId(draft.label);
    if (providers.some((p) => p.id === id)) return;
    const next: CustomAiProviderForm = { ...draft, id };
    onProvidersChange([...providers, next]);
    const nextRouting = { ...routing };
    for (const uc of next.useCases) {
      nextRouting[uc] = `custom:${id}`;
    }
    onRoutingChange(nextRouting);
    setDraft(null);
  };

  const removeProvider = (id: string) => {
    onProvidersChange(providers.filter((p) => p.id !== id));
    const nextRouting = { ...routing };
    for (const uc of AI_USE_CASES) {
      if (nextRouting[uc] === `custom:${id}`) nextRouting[uc] = "default";
    }
    onRoutingChange(nextRouting);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-5 w-5 text-teal-700" />
            Provider by use case
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Override the global provider for specific features. Custom providers must be OpenAI-compatible (chat
            API). Image routing works when an image model is set on the custom profile.
          </p>
          {AI_USE_CASES.map((uc) => (
            <div key={uc} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="text-sm sm:w-52 shrink-0">{AI_USE_CASE_LABELS[uc]}</Label>
              <select
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                value={routing[uc] ?? "default"}
                onChange={(e) =>
                  onRoutingChange({ ...routing, [uc]: e.target.value })
                }
              >
                {routeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Custom providers</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setDraft(emptyProvider())}
          >
            <Plus className="h-4 w-4" />
            Add provider
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length === 0 && !draft && (
            <p className="text-sm text-muted-foreground">
              Add an Azure OpenAI, LiteLLM, or other OpenAI-compatible endpoint and assign use cases.
            </p>
          )}

          {providers.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-red-600 shrink-0"
                  onClick={() => removeProvider(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.baseUrl} · chat: {p.chatModel}
                {p.imageModel ? ` · images: ${p.imageModel}` : ""}
              </p>
              <p className="text-xs">
                Use cases:{" "}
                {p.useCases.length
                  ? p.useCases.map((u) => AI_USE_CASE_LABELS[u]).join(", ")
                  : "none (assign in routing above)"}
              </p>
              <div>
                <Label className="text-xs">API key</Label>
                <Input
                  type="password"
                  className="mt-1 h-9"
                  placeholder={p.apiKey === "***" ? "Saved (enter to replace)" : "sk-..."}
                  value={p.apiKey === "***" ? "" : p.apiKey}
                  onChange={(e) =>
                    onProvidersChange(
                      providers.map((row) =>
                        row.id === p.id ? { ...row, apiKey: e.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}

          {draft && (
            <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/30 p-4 space-y-3">
              <p className="text-sm font-semibold">New provider</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    className="mt-1"
                    value={draft.label}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        label: e.target.value,
                        id: slugifyProviderId(e.target.value),
                      })
                    }
                    placeholder="Azure OpenAI (production)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Base URL</Label>
                  <Input
                    className="mt-1 font-mono text-xs"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Chat model</Label>
                  <Input
                    className="mt-1"
                    value={draft.chatModel}
                    onChange={(e) => setDraft({ ...draft, chatModel: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Image model (optional)</Label>
                  <Input
                    className="mt-1"
                    value={draft.imageModel}
                    onChange={(e) => setDraft({ ...draft, imageModel: e.target.value })}
                    placeholder="gpt-image-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">API key</Label>
                  <Input
                    type="password"
                    className="mt-1"
                    value={draft.apiKey}
                    onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Use cases for this provider</Label>
                <div className="flex flex-wrap gap-3">
                  {AI_USE_CASES.map((uc) => (
                    <label key={uc} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.useCases.includes(uc)}
                        onCheckedChange={(checked) => {
                          setDraft({
                            ...draft,
                            useCases: checked
                              ? [...draft.useCases, uc]
                              : draft.useCases.filter((u) => u !== uc),
                          });
                        }}
                      />
                      {AI_USE_CASE_LABELS[uc]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addProvider}>
                  Add provider
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Flatten providers + routing into settings map keys for PUT /admin/settings */
export function serializeCustomProvidersForSave(
  providers: CustomAiProviderForm[],
  routing: Partial<Record<AiUseCase, string>>,
): Record<string, string> {
  const json = providers.map(({ apiKey: _apiKey, ...rest }) => ({
    ...rest,
    imageModel: rest.imageModel.trim() || undefined,
  }));
  const out: Record<string, string> = {
    ai_custom_providers_json: JSON.stringify(json),
    ai_use_case_routing_json: JSON.stringify(routing),
  };
  for (const p of providers) {
    if (p.apiKey && p.apiKey !== "***") {
      out[customProviderApiKeySettingKey(p.id)] = p.apiKey;
    }
  }
  return out;
}

export function hydrateCustomProvidersFromSettings(
  settings: Record<string, string>,
): { providers: CustomAiProviderForm[]; routing: Partial<Record<AiUseCase, string>> } {
  const meta = parseProvidersJson(settings.ai_custom_providers_json);
  const providers: CustomAiProviderForm[] = meta.map((m) => ({
    ...m,
    imageModel: m.imageModel ?? "",
    apiKey: settings[customProviderApiKeySettingKey(m.id)] ?? "",
  }));
  return {
    providers,
    routing: parseRoutingJson(settings.ai_use_case_routing_json),
  };
}
