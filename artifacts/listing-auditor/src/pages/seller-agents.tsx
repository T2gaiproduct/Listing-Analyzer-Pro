import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FolderOpen,
  Loader2,
  MoreVertical,
  PenLine,
  Plug,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketplaceConnections } from "@/lib/marketplace-connections";
import {
  cloneSellerAgent,
  createSellerAgent,
  createSellerAgentChat,
  deleteSellerAgentMemoryFile,
  fetchSellerAgentChats,
  fetchSellerAgentMemoryFiles,
  fetchSellerAgentMessages,
  fetchSellerAgents,
  fetchSellerAgentsMeta,
  indexWorkspaceForAgent,
  sendSellerAgentMessage,
  updateSellerAgent,
  type PlatformSkill,
  type SellerAgent,
  type SellerAgentMessage,
  uploadSellerAgentMemoryFile,
} from "@/lib/seller-agents";
import {
  isPlatformSkillEnabled,
  resolvePlatformSkills,
  togglePlatformSkill,
} from "@/lib/seller-agent-platform-skills";

const PROMPT_CATEGORIES = [
  "All",
  "Data Insights & Recommendations",
  "Data Fetching",
  "PPC Helper",
] as const;

const SUGGESTED_PROMPTS: Array<{ category: (typeof PROMPT_CATEGORIES)[number]; text: string }> = [
  { category: "Data Insights & Recommendations", text: "Summarise the story behind my performance change" },
  { category: "Data Insights & Recommendations", text: "Which listings need the most optimization right now?" },
  { category: "Data Fetching", text: "What does my workspace catalog look like?" },
  { category: "Data Fetching", text: "List my top products and their audit scores" },
  { category: "PPC Helper", text: "Suggest negative keywords from wasted ad spend patterns" },
  { category: "PPC Helper", text: "Compare campaign performance and recommend bid changes" },
];

function SidebarSection({
  title,
  icon: Icon,
  open,
  onToggle,
  onAdd,
  children,
}: {
  title: string;
  icon: typeof FolderOpen;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60">
      <div className="flex items-center gap-1 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left text-xs text-foreground">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{title}</span>
        </button>
        {onAdd ? (
          <button type="button" onClick={onAdd} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Plus className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      {open ? <div className="px-3 pb-3 space-y-1">{children}</div> : null}
    </div>
  );
}

function SkillsPanel({
  skills,
  enabledSkills,
  onToggle,
  onCreateSkill,
  isUpdating,
}: {
  skills: PlatformSkill[];
  enabledSkills: string[];
  onToggle: (skillId: string, enabled: boolean) => void;
  onCreateSkill: () => void;
  isUpdating: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="rounded-xl border border-border/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80">
          <h2 className="text-[15px] font-semibold text-slate-900">Skills</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-medium border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={onCreateSkill}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New
          </Button>
        </div>
        <div className="max-h-[min(70vh,640px)] overflow-y-auto">
          {skills.map((skill, index) => {
            const enabled = isPlatformSkillEnabled(skill.id, enabledSkills);
            return (
              <div
                key={skill.id}
                className={cn(
                  "flex items-start gap-4 px-5 py-4",
                  index < skills.length - 1 && "border-b border-border/60",
                )}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900">{skill.id}</span>
                    {skill.isPlatform ? (
                      <BadgeCheck className="w-4 h-4 text-sky-500 shrink-0 fill-sky-50" />
                    ) : null}
                  </div>
                  <p className="text-[13px] leading-5 text-slate-500 line-clamp-2 pr-2">
                    {skill.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
                  <Switch
                    checked={enabled}
                    disabled={isUpdating}
                    onCheckedChange={(checked) => onToggle(skill.id, checked)}
                    className="data-[state=checked]:bg-emerald-700 data-[state=unchecked]:bg-slate-200"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label={`More options for ${skill.id}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem disabled>View details</DropdownMenuItem>
                      <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SellerAgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"basic" | "agent">("agent");
  const [promptCategory, setPromptCategory] = useState<(typeof PROMPT_CATEGORIES)[number]>("All");
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [connectedOpen, setConnectedOpen] = useState(true);
  const [workspaceView, setWorkspaceView] = useState<"skills" | "chat">("skills");
  const [createOpen, setCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentInstructions, setNewAgentInstructions] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["seller-agents"],
    queryFn: fetchSellerAgents,
  });

  const metaQuery = useQuery({
    queryKey: ["seller-agents-meta"],
    queryFn: fetchSellerAgentsMeta,
  });

  const platformSkills = useMemo(
    () => resolvePlatformSkills(metaQuery.data?.platformSkills),
    [metaQuery.data?.platformSkills],
  );

  const connectionsQuery = useQuery({
    queryKey: ["marketplace-connections"],
    queryFn: fetchMarketplaceConnections,
  });

  const agents = agentsQuery.data?.agents ?? [];
  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0]!.id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (selectedAgent) setMode(selectedAgent.mode === "basic" ? "basic" : "agent");
  }, [selectedAgent]);

  const chatsQuery = useQuery({
    queryKey: ["seller-agent-chats", selectedAgentId],
    queryFn: () => fetchSellerAgentChats(selectedAgentId!),
    enabled: Boolean(selectedAgentId),
  });

  const memoryQuery = useQuery({
    queryKey: ["seller-agent-memory", selectedAgentId],
    queryFn: () => fetchSellerAgentMemoryFiles(selectedAgentId!),
    enabled: Boolean(selectedAgentId),
  });

  const messagesQuery = useQuery({
    queryKey: ["seller-agent-messages", selectedAgentId, activeChatId],
    queryFn: () => fetchSellerAgentMessages(selectedAgentId!, activeChatId!),
    enabled: Boolean(selectedAgentId && activeChatId),
  });

  const createAgentMutation = useMutation({
    mutationFn: () => createSellerAgent({
      name: newAgentName.trim(),
      instructions: newAgentInstructions.trim(),
      mode,
    }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
      setSelectedAgentId(result.agent.id);
      setCreateOpen(false);
      setNewAgentName("");
      setNewAgentInstructions("");
      toast({ title: "Agent created", description: `${result.agent.name} is ready.` });
    },
    onError: (error) => {
      toast({
        title: "Could not create agent",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: (nextMode: "basic" | "agent") =>
      updateSellerAgent(selectedAgentId!, { mode: nextMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
    },
  });

  const updateSkillsMutation = useMutation({
    mutationFn: (enabledSkills: string[]) =>
      updateSellerAgent(selectedAgentId!, { enabledSkills }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
    },
    onError: (error) => {
      toast({
        title: "Could not update skills",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const newChatMutation = useMutation({
    mutationFn: () => createSellerAgentChat(selectedAgentId!),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-chats", selectedAgentId] });
      setActiveChatId(result.chat.id);
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ chatId, content }: { chatId: number; content: string }) =>
      sendSellerAgentMessage(selectedAgentId!, chatId, content),
    onSuccess: (_result, variables) => {
      setDraft("");
      void queryClient.invalidateQueries({
        queryKey: ["seller-agent-messages", selectedAgentId, variables.chatId],
      });
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-chats", selectedAgentId] });
    },
    onError: (error) => {
      toast({
        title: "Agent message failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const uploadMemoryMutation = useMutation({
    mutationFn: (input: { fileName: string; content: string }) =>
      uploadSellerAgentMemoryFile(selectedAgentId!, input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-memory", selectedAgentId] });
      toast({ title: "Memory file added", description: `${result.chunkCount} chunks indexed.` });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const indexWorkspaceMutation = useMutation({
    mutationFn: () => indexWorkspaceForAgent(selectedAgentId!),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-memory", selectedAgentId] });
      toast({ title: "Workspace indexed", description: `${result.chunkCount} memory chunks created.` });
    },
    onError: (error) => {
      toast({
        title: "Index failed",
        description: error instanceof Error ? error.message : "Import listings first.",
        variant: "destructive",
      });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (fileId: number) => deleteSellerAgentMemoryFile(selectedAgentId!, fileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-memory", selectedAgentId] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (agentId: number) => cloneSellerAgent(agentId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
      setSelectedAgentId(result.agent.id);
      toast({ title: "Agent cloned" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.messages, sendMutation.isPending]);

  async function handleMemoryFileUpload(file: File) {
    const text = await file.text();
    await uploadMemoryMutation.mutateAsync({
      fileName: file.name,
      content: text,
      mimeType: file.type || "text/plain",
    });
  }

  async function handleSend(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if (!content || !selectedAgentId || sendMutation.isPending) return;

    setWorkspaceView("chat");

    let chatId = activeChatId;
    if (!chatId) {
      const result = await createSellerAgentChat(selectedAgentId);
      chatId = result.chat.id;
      setActiveChatId(chatId);
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-chats", selectedAgentId] });
    }

    if (!contentOverride) setDraft(content);
    sendMutation.mutate({ chatId, content });
  }

  function handleModeChange(nextMode: "basic" | "agent") {
    setMode(nextMode);
    if (selectedAgentId) updateModeMutation.mutate(nextMode);
  }

  function handleSkillToggle(skillId: string, enabled: boolean) {
    if (!selectedAgent) return;
    const nextSkills = togglePlatformSkill(skillId, enabled, selectedAgent.enabledSkills ?? []);
    updateSkillsMutation.mutate(nextSkills);
  }

  const messages = messagesQuery.data?.messages ?? [];
  const showChatWelcome = workspaceView === "chat" && messages.length === 0 && !sendMutation.isPending;
  const showSkillsPanel = workspaceView === "skills" && messages.length === 0 && !sendMutation.isPending;
  const filteredPrompts = SUGGESTED_PROMPTS.filter(
    (p) => promptCategory === "All" || p.category === promptCategory,
  );

  const connections = connectionsQuery.data;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[640px] -mx-4 -mt-2 md:-mx-6 bg-background">
      {/* Inner left pane — SellerMate style */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <Select
            value={selectedAgentId ? String(selectedAgentId) : undefined}
            onValueChange={(value) => {
              setSelectedAgentId(Number(value));
              setActiveChatId(null);
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)} className="text-xs">
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => {
            setWorkspaceView("chat");
            setActiveChatId(null);
            newChatMutation.mutate();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b border-border/60",
            workspaceView === "chat" ? "bg-muted/60 text-foreground" : "hover:bg-muted/60",
          )}
        >
          <PenLine className="w-3.5 h-3.5" />
          New chat
        </button>

        <button
          type="button"
          disabled
          className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground border-b border-border/60 cursor-not-allowed"
        >
          <Clock className="w-3.5 h-3.5" />
          Automations
          <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
        </button>

        <div className="flex-1 overflow-y-auto">
          <SidebarSection
            title="Memory Files"
            icon={FolderOpen}
            open={memoryOpen}
            onToggle={() => setMemoryOpen((v) => !v)}
            onAdd={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleMemoryFileUpload(file);
                e.currentTarget.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[11px] mb-1"
              onClick={() => indexWorkspaceMutation.mutate()}
              disabled={!selectedAgentId || indexWorkspaceMutation.isPending}
            >
              {indexWorkspaceMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Learn from workspace
            </Button>
            {(memoryQuery.data?.files ?? []).map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-1 text-[11px] rounded-md bg-muted/40 px-2 py-1">
                <span className="truncate">{file.fileName}</span>
                <button type="button" onClick={() => deleteMemoryMutation.mutate(file.id)}>
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
            {(memoryQuery.data?.files ?? []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No files yet</p>
            ) : null}
          </SidebarSection>

          <SidebarSection
            title="Skills"
            icon={Sparkles}
            open={skillsOpen}
            onToggle={() => {
              setSkillsOpen((v) => !v);
              setWorkspaceView("skills");
            }}
            onAdd={() => {
              setWorkspaceView("skills");
              setCreateOpen(true);
            }}
          >
            <button
              type="button"
              onClick={() => setWorkspaceView("skills")}
              className={cn(
                "w-full text-left text-[11px] rounded-md px-2 py-1.5",
                workspaceView === "skills" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {platformSkills.length} platform skills
            </button>
          </SidebarSection>

          <SidebarSection
            title="Connected Apps"
            icon={Plug}
            open={connectedOpen}
            onToggle={() => setConnectedOpen((v) => !v)}
          >
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Amazon</span>
                <span className={connections?.amazon.connected ? "text-emerald-600" : "text-muted-foreground"}>
                  {connections?.amazon.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shopify</span>
                <span className={connections?.shopify.connected ? "text-emerald-600" : "text-muted-foreground"}>
                  {connections?.shopify.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>WooCommerce</span>
                <span className={connections?.woocommerce.connected ? "text-emerald-600" : "text-muted-foreground"}>
                  {connections?.woocommerce.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <Link href="/marketplaces" className="inline-block mt-1 text-primary hover:underline">
                Manage connections →
              </Link>
            </div>
          </SidebarSection>
        </div>

        <div className="p-2 border-t border-border space-y-1">
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-[11px] justify-start"
            onClick={() => selectedAgent && cloneMutation.mutate(selectedAgent.id)}
          >
            <Copy className="w-3 h-3 mr-1" /> Clone agent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-[11px] justify-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> Create agent
          </Button>
        </div>
      </aside>

      {/* Main chat workspace */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#f8faf9]">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {showSkillsPanel ? (
            <SkillsPanel
              skills={platformSkills}
              enabledSkills={selectedAgent?.enabledSkills ?? []}
              onToggle={handleSkillToggle}
              onCreateSkill={() => setCreateOpen(true)}
              isUpdating={updateSkillsMutation.isPending}
            />
          ) : showChatWelcome ? (
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="text-2xl">👋</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hi! I can automatically plan, fetch, and analyze your Amazon listings and ads data.
                Just describe what you want — for example, &quot;Compare my top campaigns&quot; or
                &quot;Improve my listing titles.&quot;
              </p>

              <div className="text-left space-y-3">
                <p className="text-xs font-medium text-foreground">Try one of these prompts</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setPromptCategory(category)}
                      className={cn(
                        "text-[11px] rounded-full px-3 py-1 border",
                        promptCategory === category
                          ? "bg-foreground text-background border-foreground"
                          : "bg-white text-muted-foreground border-border hover:border-foreground/30",
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {filteredPrompts.map((prompt) => (
                    <button
                      key={prompt.text}
                      type="button"
                      onClick={() => void handleSend(prompt.text)}
                      className="w-full text-left text-xs rounded-xl border border-border bg-white px-4 py-3 hover:border-foreground/20 hover:shadow-sm transition-all"
                    >
                      {prompt.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3 pb-4">
              {messages.map((message: SellerAgentMessage) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap max-w-[90%]",
                    message.role === "user"
                      ? "bg-foreground text-background ml-auto"
                      : "bg-white border border-border text-foreground",
                  )}
                >
                  {message.content}
                </div>
              ))}
              {sendMutation.isPending ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking…
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border bg-white px-6 py-4">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-white shadow-sm p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Ask ${selectedAgent?.name ?? "AI"} to analyze your Amazon data…`}
              className="min-h-[72px] text-sm border-0 shadow-none resize-none focus-visible:ring-0 px-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-2">
              <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => handleModeChange("basic")}
                  className={cn(
                    "text-[11px] px-3 py-1 rounded-full transition-colors",
                    mode === "basic" ? "bg-white shadow-sm font-medium" : "text-muted-foreground",
                  )}
                >
                  Basic
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("agent")}
                  className={cn(
                    "text-[11px] px-3 py-1 rounded-full transition-colors flex items-center gap-1",
                    mode === "agent" ? "bg-emerald-600 text-white shadow-sm font-medium" : "text-muted-foreground",
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  Agent
                </button>
              </div>
              <Button
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => void handleSend()}
                disabled={!draft.trim() || sendMutation.isPending || !selectedAgentId}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create AI agent</DialogTitle>
            <DialogDescription>
              Custom agents have separate memory and instructions for your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="My Catalog Coach"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Instructions</Label>
              <Textarea
                value={newAgentInstructions}
                onChange={(e) => setNewAgentInstructions(e.target.value)}
                placeholder="You are an Amazon listing expert for my brand…"
                className="min-h-[120px] text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAgentMutation.mutate()}
              disabled={createAgentMutation.isPending || !newAgentName.trim() || !newAgentInstructions.trim()}
            >
              {createAgentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
