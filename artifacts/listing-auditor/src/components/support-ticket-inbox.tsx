import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, LifeBuoy, Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  fetchMySupportTickets,
  lastReplyFrom,
  MY_SUPPORT_TICKETS_QUERY_KEY,
  replyToMySupportTicket,
  type MySupportTicket,
  type SupportTicketReply,
} from "@/lib/support-tickets";
import { cn } from "@/lib/utils";

function formatTicketDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "MMM d, yyyy HH:mm");
}

function ticketStatusLabel(ticket: MySupportTicket): { text: string; className: string } {
  const last = lastReplyFrom(ticket);
  if (last === "admin") {
    return { text: "Support replied", className: "bg-orange-100 text-orange-700 border-transparent" };
  }
  if (last === "customer" || ticket.replies.length > 0) {
    return { text: "Awaiting support", className: "bg-slate-100 text-slate-600 border-transparent" };
  }
  return { text: "Open", className: "bg-slate-100 text-slate-600 border-transparent" };
}

function ThreadMessage({
  author,
  at,
  message,
  align,
}: {
  author: string;
  at: string;
  message: string;
  align: "start" | "end";
}) {
  return (
    <div className={cn("flex", align === "end" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-lg border p-3",
          align === "end" ? "bg-orange-50 border-orange-100" : "bg-slate-50 border-slate-100",
        )}
      >
        <p className="text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">{author}</span>
          {at ? ` · ${at}` : ""}
        </p>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function TicketThread({
  ticket,
  onReplied,
}: {
  ticket: MySupportTicket;
  onReplied: (ticket: MySupportTicket) => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  const replyMutation = useMutation({
    mutationFn: () => replyToMySupportTicket(ticket.id, message.trim()),
    onSuccess: (updated) => {
      setMessage("");
      onReplied(updated);
      toast({ title: "Reply sent", description: "Our team will see your message on this ticket." });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not send reply",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4 pt-3 border-t">
      <div className="space-y-3">
        <ThreadMessage
          author="You"
          at={formatTicketDate(ticket.createdAt)}
          message={ticket.message || "No message provided"}
          align="end"
        />
        {ticket.replies.map((reply: SupportTicketReply, index) => (
          <ThreadMessage
            key={`${reply.sentAt}-${index}`}
            author={reply.from === "customer" ? "You" : "Support"}
            at={formatTicketDate(reply.sentAt)}
            message={reply.message}
            align={reply.from === "customer" ? "end" : "start"}
          />
        ))}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!message.trim() || replyMutation.isPending) return;
          replyMutation.mutate();
        }}
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Reply to support…"
          className="min-h-[96px] resize-y"
          disabled={replyMutation.isPending}
        />
        <Button
          type="submit"
          className="bg-orange-500 hover:bg-orange-600 text-white"
          disabled={!message.trim() || replyMutation.isPending}
        >
          {replyMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : (
            "Send reply"
          )}
        </Button>
      </form>
    </div>
  );
}

export function SupportTicketInbox() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: tickets = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: MY_SUPPORT_TICKETS_QUERY_KEY,
    queryFn: fetchMySupportTickets,
  });

  function handleReplied(updated: MySupportTicket) {
    qc.setQueryData<MySupportTicket[]>(MY_SUPPORT_TICKETS_QUERY_KEY, (current) => {
      const list = current ?? [];
      const next = list.map((t) => (t.id === updated.id ? updated : t));
      return next.sort((a, b) => {
        const aLast = a.replies[a.replies.length - 1]?.sentAt ?? a.createdAt;
        const bLast = b.replies[b.replies.length - 1]?.sentAt ?? b.createdAt;
        return bLast.localeCompare(aLast);
      });
    });
    void qc.invalidateQueries({ queryKey: MY_SUPPORT_TICKETS_QUERY_KEY });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-orange-500" />
          Your tickets
        </CardTitle>
        <CardDescription>
          Open a ticket to read support replies and continue the conversation here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your tickets…</p>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load tickets."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8">
            <LifeBuoy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tickets yet. Submit one above to get help.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const open = openId === ticket.id;
              const status = ticketStatusLabel(ticket);
              return (
                <div
                  key={ticket.id}
                  className={cn(
                    "rounded-lg border p-3",
                    open ? "border-orange-200 bg-orange-50/40" : "border-border bg-card",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left flex items-start gap-3"
                    onClick={() => setOpenId(open ? null : ticket.id)}
                    aria-expanded={open}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <Badge className={status.className}>{status.text}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        #{ticket.id} · {formatTicketDate(ticket.createdAt)}
                        {ticket.replies.length > 0
                          ? ` · ${ticket.replies.length} ${ticket.replies.length === 1 ? "reply" : "replies"}`
                          : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 mt-1 text-muted-foreground shrink-0 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open && (
                    <TicketThread ticket={ticket} onReplied={handleReplied} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
