import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { AgentToolDefinition } from "@/lib/sellermate-ai";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEFAULT_NEW_AGENT_PROMPT = `You are a SellerLens AI assistant for Amazon sellers.
Help users with clear, actionable guidance. Ask clarifying questions when context is missing.`;

type DefaultSellermateAgentTemplate = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  model: string;
  systemPrompt: string;
  tools: string[];
};

type DefaultAgentsResponse = {
  agents: DefaultSellermateAgentTemplate[];
  tools: AgentToolDefinition[];
  models: string[];
  iconOptions?: string[];
};

const ICON_LABELS: Record<string, string> = {
  image: "Image",
  "clipboard-check": "Clipboard",
  target: "Target",
  chart: "Chart",
  search: "Search",
  sparkles: "Sparkles",
};

function slugifyDefaultAgentName(name: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs.map((slug) => slug.toLowerCase()));
  let base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!base) base = "agent";
  let slug = base;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function createBlankDefaultAgent(existing: DefaultSellermateAgentTemplate[]): DefaultSellermateAgentTemplate {
  const name = "New Default Agent";
  return {
    slug: slugifyDefaultAgentName(name, existing.map((agent) => agent.slug)),
    name,
    description: "",
    icon: "sparkles",
    model: "gpt-5.4",
    systemPrompt: DEFAULT_NEW_AGENT_PROMPT,
    tools: ["get_seller_memory", "save_agent_memory"],
  };
}

async function fetchDefaultAgents(): Promise<DefaultAgentsResponse> {
  const endpoints = [
    `${basePath}/api/admin/sellermate/default-agents`,
    `${basePath}/api/admin/settings?category=sellermate_default_agents`,
  ];

  let lastError = "Failed to load default agents.";
  for (const url of endpoints) {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 404) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      lastError = data.error ?? lastError;
      continue;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Failed to load default agents.");
    }
    return res.json() as Promise<DefaultAgentsResponse>;
  }
  throw new Error(lastError);
}

async function saveDefaultAgents(agents: DefaultSellermateAgentTemplate[]): Promise<DefaultAgentsResponse> {
  const dedicated = await fetch(`${basePath}/api/admin/sellermate/default-agents`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agents }),
  });

  if (dedicated.status !== 404) {
    const data = await dedicated.json().catch(() => ({})) as DefaultAgentsResponse & { error?: string };
    if (!dedicated.ok) {
      throw new Error(data.error ?? "Failed to save default agents.");
    }
    return data;
  }

  const res = await fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "sellermate_default_agents", agents }),
  });
  const data = await res.json().catch(() => ({})) as DefaultAgentsResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to save default agents.");
  }
  return data;
}

export default function AdminSettingsDefaultAgents() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<DefaultSellermateAgentTemplate[]>([]);

  const query = useQuery({
    queryKey: ["admin-sellermate-default-agents"],
    queryFn: fetchDefaultAgents,
  });

  useEffect(() => {
    if (query.data?.agents) {
      setAgents(query.data.agents);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveDefaultAgents(agents),
    onSuccess: (data) => {
      setAgents(data.agents);
      toast({
        title: "Default agents saved",
        description: "Updates were applied to all workspaces.",
      });
    },
    onError: (error) => {
      toast({
        title: "Could not save default agents",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const toolCatalog = query.data?.tools ?? [];
  const models = query.data?.models ?? ["gpt-5.4"];
  const iconOptions = query.data?.iconOptions ?? ["sparkles", "image", "clipboard-check", "target", "chart", "search"];

  function updateAgent(index: number, patch: Partial<DefaultSellermateAgentTemplate>) {
    setAgents((current) => current.map((agent, i) => (i === index ? { ...agent, ...patch } : agent)));
  }

  function toggleTool(index: number, toolName: string) {
    setAgents((current) => current.map((agent, i) => {
      if (i !== index) return agent;
      const enabled = new Set(agent.tools);
      if (enabled.has(toolName)) {
        enabled.delete(toolName);
      } else {
        enabled.add(toolName);
      }
      return { ...agent, tools: [...enabled] };
    }));
  }

  function addAgent() {
    setAgents((current) => [...current, createBlankDefaultAgent(current)]);
  }

  function removeAgent(index: number) {
    if (agents.length <= 1) return;
    setAgents((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Default SellerLens Agents</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        These agents appear for every seller under <strong>Default agents</strong> in SellerLens AI.
        Sellers cannot edit them — they can duplicate a default agent to create a custom copy.
        Removing an agent here retires it from all workspaces on save.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {query.isLoading && (
            <p className="text-sm text-slate-500">Loading default agents…</p>
          )}

          {query.isError && (
            <p className="text-sm text-red-600">
              {query.error instanceof Error ? query.error.message : "Failed to load default agents."}
            </p>
          )}

          {agents.map((agent, index) => (
            <div key={`${agent.slug}-${index}`} className="rounded-lg border border-slate-200 p-4 space-y-4 bg-slate-50/40">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">{agent.name || "Untitled agent"}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{agent.slug}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                    onClick={() => removeAgent(index)}
                    disabled={agents.length <= 1}
                    title={agents.length <= 1 ? "At least one default agent is required" : "Remove agent"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-name-${agent.slug}`}>Display name</Label>
                  <Input
                    id={`agent-name-${agent.slug}`}
                    value={agent.name}
                    onChange={(e) => updateAgent(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-model-${agent.slug}`}>Model</Label>
                  <select
                    id={`agent-model-${agent.slug}`}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                    value={agent.model}
                    onChange={(e) => updateAgent(index, { model: e.target.value })}
                  >
                    {models.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-description-${agent.slug}`}>Description</Label>
                  <Input
                    id={`agent-description-${agent.slug}`}
                    value={agent.description}
                    onChange={(e) => updateAgent(index, { description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-icon-${agent.slug}`}>Icon</Label>
                  <select
                    id={`agent-icon-${agent.slug}`}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                    value={agent.icon}
                    onChange={(e) => updateAgent(index, { icon: e.target.value })}
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>
                        {ICON_LABELS[icon] ?? icon}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`agent-prompt-${agent.slug}`}>System prompt</Label>
                <Textarea
                  id={`agent-prompt-${agent.slug}`}
                  value={agent.systemPrompt}
                  onChange={(e) => updateAgent(index, { systemPrompt: e.target.value })}
                  className="min-h-[140px] font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label>Enabled tools</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {toolCatalog.map((tool) => (
                    <label
                      key={`${agent.slug}-${tool.name}`}
                      className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={agent.tools.includes(tool.name)}
                        onChange={() => toggleTool(index, tool.name)}
                      />
                      <span>
                        <span className="font-medium text-slate-800">{tool.label}</span>
                        <span className="block text-xs text-slate-500">{tool.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addAgent}
              disabled={query.isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add default agent
            </Button>

            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || agents.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? "Saving…" : "Save Default Agents"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
