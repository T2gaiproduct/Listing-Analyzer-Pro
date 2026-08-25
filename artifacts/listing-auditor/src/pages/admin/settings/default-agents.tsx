import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { AgentToolDefinition } from "@/lib/sellermate-ai";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
};

async function fetchDefaultAgents(): Promise<DefaultAgentsResponse> {
  const res = await fetch(`${basePath}/api/admin/sellermate/default-agents`, {
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Failed to load default agents.");
  }
  return res.json() as Promise<DefaultAgentsResponse>;
}

async function saveDefaultAgents(agents: DefaultSellermateAgentTemplate[]): Promise<DefaultAgentsResponse> {
  const res = await fetch(`${basePath}/api/admin/sellermate/default-agents`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agents }),
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Default SellerLens Agents</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        These three agents appear for every seller under <strong>Default agents</strong> in SellerLens AI.
        Sellers cannot edit them — they can duplicate a default agent to create a custom copy.
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
            <div key={agent.slug} className="rounded-lg border border-slate-200 p-4 space-y-4 bg-slate-50/40">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">{agent.name}</h2>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{agent.slug}</span>
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

              <div className="space-y-1.5">
                <Label htmlFor={`agent-description-${agent.slug}`}>Description</Label>
                <Input
                  id={`agent-description-${agent.slug}`}
                  value={agent.description}
                  onChange={(e) => updateAgent(index, { description: e.target.value })}
                />
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

          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || agents.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {save.isPending ? "Saving…" : "Save Default Agents"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
