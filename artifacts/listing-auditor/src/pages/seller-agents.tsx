import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  Loader2,
  PenLine,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  cloneSellerAgent,
  createSellerAgent,
  createSellerAgentChat,
  deleteSellerAgent,
  deleteSellerAgentMemoryFile,
  fetchSellerAgentChats,
  fetchSellerAgentMemoryFiles,
  fetchSellerAgentMessages,
  fetchSellerAgents,
  indexWorkspaceForAgent,
  sendSellerAgentMessage,
  updateSellerAgent,
  type SellerAgent,
  type SellerAgentMessage,
  uploadSellerAgentMemoryFile,
} from "@/lib/seller-agents";

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

export default function SellerAgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"basic" | "agent">("agent");
  const [promptCategory, setPromptCategory] = useState<(typeof PROMPT_CATEGORIES)[number]>("All");
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentInstructions, setNewAgentInstructions] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["seller-agents"],
    queryFn: fetchSellerAgents,
  });

  const agents = agentsQuery.data?.agents ?? [];
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      if (a.isPlatformTemplate !== b.isPlatformTemplate) {
        return a.isPlatformTemplate ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [agents]);
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

  const deleteAgentMutation = useMutation({
    mutationFn: (agentId: number) => deleteSellerAgent(agentId),
    onSuccess: (_result, deletedAgentId) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
      setDeleteOpen(false);
      setActiveChatId(null);
      const cached = queryClient.getQueryData<{ agents: SellerAgent[] }>(["seller-agents"]);
      const remaining = (cached?.agents ?? agents).filter((agent) => agent.id !== deletedAgentId);
      setSelectedAgentId(remaining.find((agent) => agent.isPlatformTemplate)?.id ?? remaining[0]?.id ?? null);
      toast({ title: "Agent deleted" });
    },
    onError: (error) => {
      toast({
        title: "Could not delete agent",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
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

  const messages = messagesQuery.data?.messages ?? [];
  const showWelcome = messages.length === 0 && !sendMutation.isPending;
  const filteredPrompts = SUGGESTED_PROMPTS.filter(
    (p) => promptCategory === "All" || p.category === promptCategory,
  );

  const canDeleteSelectedAgent = Boolean(selectedAgent && !selectedAgent.isPlatformTemplate);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[640px] -mx-4 -mt-2 md:-mx-6 bg-background">
      {/* Inner left pane — SellerMate style */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <SidebarSection
            title="Agents"
            icon={Bot}
            open={agentsOpen}
            onToggle={() => setAgentsOpen((v) => !v)}
            onAdd={() => setCreateOpen(true)}
          >
            {agentsQuery.isLoading ? (
              <p className="text-[11px] text-muted-foreground px-1">Loading agents…</p>
            ) : sortedAgents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-1">No agents yet</p>
            ) : (
              sortedAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setActiveChatId(null);
                  }}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-1.5 text-[11px] transition-colors",
                    selectedAgentId === agent.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className="line-clamp-2">{agent.name}</span>
                </button>
              ))
            )}
          </SidebarSection>

        <button
          type="button"
          onClick={() => {
            setActiveChatId(null);
            newChatMutation.mutate();
          }}
          className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-muted/60 border-b border-border/60"
        >
          <PenLine className="w-3.5 h-3.5" />
          New chat
        </button>

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
        </div>

        <div className="p-2 border-t border-border space-y-1">
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-[11px] justify-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> Create agent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-[11px] justify-start"
            onClick={() => selectedAgent && cloneMutation.mutate(selectedAgent.id)}
            disabled={!selectedAgent || cloneMutation.isPending}
          >
            <Copy className="w-3 h-3 mr-1" /> Clone agent
          </Button>
          {canDeleteSelectedAgent ? (
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-[11px] justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteAgentMutation.isPending}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete agent
            </Button>
          ) : null}
        </div>
      </aside>

      {/* Main chat workspace */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#f8faf9]">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {showWelcome ? (
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">{selectedAgent?.name}</span> and its chats.
              Default platform agents cannot be deleted — only custom or cloned agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedAgentId && deleteAgentMutation.mutate(selectedAgentId)}
              disabled={deleteAgentMutation.isPending}
            >
              {deleteAgentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
