import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Brain,
  Copy,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  deleteSellerAgentMemoryFile,
  fetchSellerAgentChats,
  fetchSellerAgentMemoryFiles,
  fetchSellerAgentMessages,
  fetchSellerAgents,
  indexWorkspaceForAgent,
  sendSellerAgentMessage,
  type SellerAgent,
  type SellerAgentMessage,
  uploadSellerAgentMemoryFile,
} from "@/lib/seller-agents";

function agentIcon(icon: string) {
  switch (icon) {
    case "zap":
      return Zap;
    case "file-search":
      return FileText;
    default:
      return Bot;
  }
}

export default function SellerAgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"basic" | "agent">("basic");
  const [createOpen, setCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentInstructions, setNewAgentInstructions] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["seller-agents"],
    queryFn: fetchSellerAgents,
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
    if (selectedAgent) setMode(selectedAgent.mode === "agent" ? "agent" : "basic");
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

  useEffect(() => {
    const chats = chatsQuery.data?.chats ?? [];
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0]!.id);
    }
  }, [chatsQuery.data?.chats, activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.messages]);

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

  const cloneMutation = useMutation({
    mutationFn: (agentId: number) => cloneSellerAgent(agentId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["seller-agents"] });
      setSelectedAgentId(result.agent.id);
      toast({ title: "Agent cloned", description: "Customize your copy in a new agent." });
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

  async function handleMemoryFileUpload(file: File) {
    const text = await file.text();
    await uploadMemoryMutation.mutateAsync({
      fileName: file.name,
      content: text,
      mimeType: file.type || "text/plain",
    });
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || !selectedAgentId || sendMutation.isPending) return;

    let chatId = activeChatId;
    if (!chatId) {
      const result = await createSellerAgentChat(selectedAgentId);
      chatId = result.chat.id;
      setActiveChatId(chatId);
      void queryClient.invalidateQueries({ queryKey: ["seller-agent-chats", selectedAgentId] });
    }

    sendMutation.mutate({ chatId, content });
  }

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[640px] gap-4">
      <aside className="w-64 shrink-0 rounded-xl border border-border bg-card p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Seller Agents</h2>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="space-y-1 overflow-y-auto flex-1">
          {agents.map((agent) => {
            const Icon = agentIcon(agent.icon);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  setActiveChatId(null);
                }}
                className={cn(
                  "w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors",
                  selectedAgentId === agent.id ? "bg-muted text-foreground" : "hover:bg-muted/60 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium truncate">{agent.name}</span>
                </div>
                {agent.isDefault ? (
                  <span className="text-[10px] text-muted-foreground ml-5">Default</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex-1 rounded-xl border border-border bg-card flex flex-col min-w-0">
        {selectedAgent ? (
          <>
            <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-sm font-semibold">{selectedAgent.name}</h1>
                <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => cloneMutation.mutate(selectedAgent.id)}
                  disabled={cloneMutation.isPending}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Clone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => newChatMutation.mutate()}
                  disabled={newChatMutation.isPending}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1" />
                  New chat
                </Button>
              </div>
            </header>

            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-muted-foreground">
                    Hi! I can plan, fetch context from memory, and analyze your Amazon business data. Describe what you want.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant={mode === "basic" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setMode("basic")}
                    >
                      Basic
                    </Button>
                    <Button
                      size="sm"
                      variant={mode === "agent" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setMode("agent")}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Agent
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Start a conversation with {selectedAgent.name}. Upload Memory Files or index your workspace catalog for better answers.
                    </div>
                  ) : null}
                  {messages.map((message: SellerAgentMessage) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs max-w-[85%] whitespace-pre-wrap",
                        message.role === "user"
                          ? "bg-foreground text-background ml-auto"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {message.content}
                    </div>
                  ))}
                  {sendMutation.isPending ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Thinking…
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Ask ${selectedAgent.name}…`}
                      className="min-h-[72px] text-xs resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <Button
                      className="h-auto px-3"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim() || sendMutation.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="w-72 border-l border-border p-3 space-y-4 overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-3.5 h-3.5" />
                    <h3 className="text-xs font-semibold">Memory Files</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept=".txt,.md,.csv,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleMemoryFileUpload(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      <div className="inline-flex w-full h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs hover:bg-muted">
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Upload file
                      </div>
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => indexWorkspaceMutation.mutate()}
                      disabled={indexWorkspaceMutation.isPending}
                    >
                      {indexWorkspaceMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 mr-1" />
                      )}
                      Learn from workspace
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(memoryQuery.data?.files ?? []).map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-2 text-[11px] rounded-md bg-muted/50 px-2 py-1.5">
                        <span className="truncate">{file.fileName}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => deleteMemoryMutation.mutate(file.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {(memoryQuery.data?.files ?? []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No memory files yet.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1">
                    {(selectedAgent.enabledSkills ?? []).map((skill) => (
                      <span key={skill} className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                        {skill.replace(/_/g, " ")}
                      </span>
                    ))}
                    {(selectedAgent.enabledSkills ?? []).length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">No skills enabled</span>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold mb-2">Chats</h3>
                  <div className="space-y-1">
                    {(chatsQuery.data?.chats ?? []).map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => setActiveChatId(chat.id)}
                        className={cn(
                          "w-full text-left text-[11px] rounded-md px-2 py-1.5 truncate",
                          activeChatId === chat.id ? "bg-muted" : "hover:bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {chat.title}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            {agentsQuery.isLoading ? "Loading agents…" : "Create your first seller agent."}
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create seller agent</DialogTitle>
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
