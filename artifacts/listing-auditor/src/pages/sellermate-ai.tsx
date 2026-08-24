import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Plus,
  Search,
  Send,
  Target,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  createSellermateAgent,
  deleteSellermateAgent,
  deleteSellermateMemory,
  fetchSellermateAgents,
  fetchSellermateMemory,
  fetchSellermateMessages,
  fetchSellermateThreads,
  sendSellermateChat,
  updateSellermateAgent,
  uploadSellermateMemoryFile,
  type SellermateAgent,
  type SellermateMessage,
} from "@/lib/sellermate-ai";
import { UploadMemoryFileDialog } from "@/components/upload-memory-file-dialog";
import { SellermateChatAttachMenu } from "@/components/sellermate-chat-attach-menu";
import { memoryFileToBase64, titleFromMemoryFilename } from "@/lib/sellermate-memory-upload";

function agentIcon(icon: string) {
  switch (icon) {
    case "search":
      return Search;
    case "target":
      return Target;
    case "chart":
      return BarChart3;
    default:
      return Bot;
  }
}

export default function SellerMateAiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"basic" | "agent">("agent");
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [editAgentOpen, setEditAgentOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SellermateAgent | null>(null);
  const [uploadMemoryOpen, setUploadMemoryOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");

  const agentsQuery = useQuery({
    queryKey: ["sellermate-agents"],
    queryFn: fetchSellermateAgents,
  });

  const agents = agentsQuery.data ?? [];
  const defaultAgents = useMemo(() => agents.filter((a) => a.isDefault), [agents]);
  const customAgents = useMemo(() => agents.filter((a) => !a.isDefault), [agents]);

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0]!.id);
    }
  }, [agents, selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const threadsQuery = useQuery({
    queryKey: ["sellermate-threads", selectedAgentId],
    queryFn: () => fetchSellermateThreads(selectedAgentId!),
    enabled: selectedAgentId != null,
  });

  const messagesQuery = useQuery({
    queryKey: ["sellermate-messages", activeThreadId],
    queryFn: () => fetchSellermateMessages(activeThreadId!),
    enabled: activeThreadId != null,
  });

  const memoryQuery = useQuery({
    queryKey: ["sellermate-memory", selectedAgentId],
    queryFn: () => fetchSellermateMemory(selectedAgentId!),
    enabled: selectedAgentId != null,
  });

  const messages = messagesQuery.data ?? [];
  const threads = threadsQuery.data ?? [];
  const memoryFiles = memoryQuery.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesQuery.isFetching]);

  const chatMutation = useMutation({
    mutationFn: sendSellermateChat,
    onSuccess: (result) => {
      setActiveThreadId(result.thread.id);
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["sellermate-messages", result.thread.id] });
      void queryClient.invalidateQueries({ queryKey: ["sellermate-threads", selectedAgentId] });
    },
    onError: (error) => {
      toast({
        title: "Message failed",
        description: error instanceof Error ? error.message : "Could not send message.",
        variant: "destructive",
      });
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: createSellermateAgent,
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: ["sellermate-agents"] });
      setSelectedAgentId(agent.id);
      setActiveThreadId(null);
      setCreateAgentOpen(false);
      setNewAgentName("");
      setNewAgentDescription("");
      setNewAgentPrompt("");
      toast({ title: "Agent created", description: `${agent.name} is ready to use.` });
    },
    onError: (error) => {
      toast({
        title: "Could not create agent",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: deleteSellermateAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sellermate-agents"] });
      setSelectedAgentId(null);
      setActiveThreadId(null);
      toast({ title: "Agent deleted" });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: (input: { agentId: number; name: string; description?: string; systemPrompt: string }) =>
      updateSellermateAgent(input.agentId, {
        name: input.name,
        description: input.description,
        systemPrompt: input.systemPrompt,
      }),
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: ["sellermate-agents"] });
      setSelectedAgentId(agent.id);
      setEditAgentOpen(false);
      setEditingAgent(null);
      setNewAgentName("");
      setNewAgentDescription("");
      setNewAgentPrompt("");
      toast({ title: "Agent updated", description: `${agent.name} was saved.` });
    },
    onError: (error) => {
      toast({
        title: "Could not update agent",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const uploadMemoryMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; filename: string; fileBase64: string }) =>
      uploadSellermateMemoryFile(selectedAgentId!, input),
    onSuccess: (memory) => {
      void queryClient.invalidateQueries({ queryKey: ["sellermate-memory", selectedAgentId] });
      setUploadMemoryOpen(false);
      toast({ title: "Memory uploaded", description: memory.name });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload memory file.",
        variant: "destructive",
      });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId: number) => deleteSellermateMemory(selectedAgentId!, memoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sellermate-memory", selectedAgentId] });
    },
  });

  function handleSelectAgent(agent: SellermateAgent) {
    setSelectedAgentId(agent.id);
    setActiveThreadId(null);
  }

  function handleNewChat() {
    setActiveThreadId(null);
    setDraft("");
  }

  function handleSend() {
    if (!selectedAgentId || !draft.trim() || chatMutation.isPending) return;
    chatMutation.mutate({
      agentId: selectedAgentId,
      message: draft.trim(),
      threadId: activeThreadId ?? undefined,
      mode,
    });
  }

  function openEditAgent(agent: SellermateAgent) {
    setEditingAgent(agent);
    setNewAgentName(agent.name);
    setNewAgentDescription(agent.description ?? "");
    setNewAgentPrompt(agent.systemPrompt ?? "");
    setEditAgentOpen(true);
  }

  function submitAgentUpdate() {
    if (!editingAgent) return;
    updateAgentMutation.mutate({
      agentId: editingAgent.id,
      name: newAgentName,
      description: newAgentDescription,
      systemPrompt: newAgentPrompt,
    });
  }

  async function handleChatMemoryFile(file: File) {
    if (!selectedAgentId || uploadMemoryMutation.isPending) return;
    try {
      const fileBase64 = await memoryFileToBase64(file);
      await uploadMemoryMutation.mutateAsync({
        name: titleFromMemoryFilename(file.name),
        filename: file.name,
        fileBase64,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not read the selected file.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] -mx-1 sm:-mx-2 flex rounded-xl border border-slate-200 bg-[#f8f9fb] shadow-sm overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 h-9 text-xs"
            onClick={handleNewChat}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4">
          <AgentSection
            title="Default agents"
            agents={defaultAgents}
            selectedAgentId={selectedAgentId}
            onSelect={handleSelectAgent}
          />

          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Your agents</p>
              <button
                type="button"
                onClick={() => setCreateAgentOpen(true)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Create agent"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <AgentSection
              agents={customAgents}
              selectedAgentId={selectedAgentId}
              onSelect={handleSelectAgent}
              onEdit={openEditAgent}
              onDelete={(agent) => deleteAgentMutation.mutate(agent.id)}
              emptyLabel="Create your first custom agent"
            />
          </div>

          <SidebarSection
            title="Memory files"
            open={memoryOpen}
            onToggle={() => setMemoryOpen((v) => !v)}
            action={
              <button
                type="button"
                onClick={() => setUploadMemoryOpen(true)}
                disabled={!selectedAgentId}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-40"
                aria-label="Add memory"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            }
          >
            {memoryFiles.length === 0 ? (
              <p className="px-2 text-[11px] text-slate-400">No memory files yet for this agent.</p>
            ) : (
              memoryFiles.map((file) => (
                <div key={file.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50">
                  <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-2">
                      {file.description?.trim() || `${file.content.length.toLocaleString()} characters`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMemoryMutation.mutate(file.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </SidebarSection>

          <SidebarSection title="Chats" open={chatsOpen} onToggle={() => setChatsOpen((v) => !v)}>
            {threads.length === 0 ? (
              <p className="px-2 text-[11px] text-slate-400">Start a conversation to see chats here.</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-[11px] truncate",
                    activeThreadId === thread.id
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {thread.title}
                </button>
              ))
            )}
          </SidebarSection>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#f8f9fb]">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-16 text-center">
              <p className="text-2xl sm:text-3xl font-medium text-slate-800 leading-snug">
                👋 Hi! I can automatically plan, fetch, and analyze your Amazon Ads data.
                Just describe what you want.
              </p>
              {selectedAgent && (
                <p className="mt-4 text-sm text-slate-500">
                  Talking to <span className="font-medium text-slate-700">{selectedAgent.name}</span>
                  {selectedAgent.description ? ` — ${selectedAgent.description}` : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {chatMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 sm:px-8 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask AI to find keywords, optimize campaigns, or analyze performance…"
                className="min-h-[72px] resize-none border-0 shadow-none focus-visible:ring-0 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <SellermateChatAttachMenu
                    disabled={!selectedAgentId || uploadMemoryMutation.isPending}
                    onFileSelected={(file) => void handleChatMemoryFile(file)}
                  />
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setMode("basic")}
                      className={cn(
                        "px-3 py-1 text-[11px] rounded-md transition-colors",
                        mode === "basic" ? "bg-white shadow-sm text-slate-800" : "text-slate-500",
                      )}
                    >
                      Basic
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("agent")}
                      className={cn(
                        "px-3 py-1 text-[11px] rounded-md transition-colors flex items-center gap-1",
                        mode === "agent" ? "bg-white shadow-sm text-slate-800" : "text-slate-500",
                      )}
                    >
                      <WandSparkles className="w-3 h-3" />
                      Agent
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="rounded-full bg-orange-500 hover:bg-orange-600"
                  disabled={!draft.trim() || chatMutation.isPending || !selectedAgentId}
                  onClick={handleSend}
                >
                  {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Create agent dialog */}
      <Dialog open={createAgentOpen} onOpenChange={setCreateAgentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create custom agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="My PPC helper" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder="What this agent helps with"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instructions</Label>
              <Textarea
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                placeholder="You are an Amazon ads expert who…"
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateAgentOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => createAgentMutation.mutate({
                name: newAgentName,
                description: newAgentDescription,
                systemPrompt: newAgentPrompt,
              })}
              disabled={createAgentMutation.isPending}
            >
              {createAgentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit agent dialog */}
      <Dialog
        open={editAgentOpen}
        onOpenChange={(open) => {
          setEditAgentOpen(open);
          if (!open) setEditingAgent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="My PPC helper" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder="What this agent helps with"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instructions</Label>
              <Textarea
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                placeholder="You are an Amazon ads expert who…"
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditAgentOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={submitAgentUpdate}
              disabled={updateAgentMutation.isPending}
            >
              {updateAgentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadMemoryFileDialog
        open={uploadMemoryOpen}
        onOpenChange={setUploadMemoryOpen}
        isUploading={uploadMemoryMutation.isPending}
        onUpload={async (input) => {
          await uploadMemoryMutation.mutateAsync(input);
        }}
      />
    </div>
  );
}

function AgentSection({
  title,
  agents,
  selectedAgentId,
  onSelect,
  onEdit,
  onDelete,
  emptyLabel,
}: {
  title?: string;
  agents: SellermateAgent[];
  selectedAgentId: number | null;
  onSelect: (agent: SellermateAgent) => void;
  onEdit?: (agent: SellermateAgent) => void;
  onDelete?: (agent: SellermateAgent) => void;
  emptyLabel?: string;
}) {
  if (agents.length === 0) {
    return emptyLabel ? <p className="px-2 text-[11px] text-slate-400">{emptyLabel}</p> : null;
  }

  return (
    <div>
      {title && (
        <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      )}
      <div className="space-y-0.5">
        {agents.map((agent) => {
          const Icon = agentIcon(agent.icon);
          return (
            <div key={agent.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(agent)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[11px]",
                  selectedAgentId === agent.id
                    ? "bg-orange-50 text-orange-700 font-medium"
                    : "text-slate-700 hover:bg-slate-50",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{agent.name}</span>
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(agent)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700"
                  aria-label={`Edit ${agent.name}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(agent)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <button type="button" onClick={onToggle} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {title}
        </button>
        {action}
      </div>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function MessageBubble({ message }: { message: SellermateMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-orange-500 text-white"
            : "bg-white border border-slate-200 text-slate-800 shadow-sm",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
