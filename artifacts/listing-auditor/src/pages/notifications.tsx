import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, AlertCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  sentAt: string;
  readAt?: string | null;
}

function fetchNotifications(limit = 100): Promise<{ notifications: NotificationItem[] }> {
  return fetch(`/api/notifications?limit=${limit}`).then((r) => r.json());
}

function markAsRead(id: number): Promise<{ ok: boolean }> {
  return fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).then((r) => r.json());
}

function markAllRead(): Promise<{ ok: boolean }> {
  return fetch("/api/notifications/read-all", { method: "POST" }).then((r) => r.json());
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => fetchNotifications(100),
  });
  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const markRead = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: NotificationItem) => {
    if (!n.read) {
      markRead.mutate(n.id);
    }
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      credit_low: "bg-yellow-100 text-yellow-700",
      credit_expired: "bg-red-100 text-red-700",
      payment_failed: "bg-red-100 text-red-700",
      payment_success: "bg-green-100 text-green-700",
      plan_expiring: "bg-orange-100 text-orange-700",
      system: "bg-blue-100 text-blue-700",
      promo: "bg-purple-100 text-purple-700",
    };
    return colors[type] ?? "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unread.length} unread, {read.length} read
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unread first */}
          {unread.map((n) => (
            <Card
              key={n.id}
              className="overflow-hidden cursor-pointer transition-colors hover:border-orange-300"
              onClick={() => handleClick(n)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <Badge className={cn("text-[10px] px-1.5 py-0", typeBadge(n.type))}>
                        {n.type}
                      </Badge>
                      <span className="w-2 h-2 bg-orange-500 rounded-full" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(n.sentAt), { addSuffix: true })}</span>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Read notifications */}
          {read.length > 0 && (
            <>
              <div className="pt-4 pb-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Read
                </p>
              </div>
              {read.map((n) => (
                <Card
                  key={n.id}
                  className="overflow-hidden bg-muted/30 border-muted/50"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-muted-foreground">{n.title}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {n.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground/70 mt-1 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                          <span>{formatDistanceToNow(new Date(n.sentAt), { addSuffix: true })}</span>
                          {n.link && (
                            <Link href={n.link} className="text-orange-500/60 hover:text-orange-600 font-medium flex items-center gap-0.5">
                              View <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
