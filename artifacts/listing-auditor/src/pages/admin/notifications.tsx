import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Plus, Trash2, Check, RefreshCw } from "lucide-react";

interface Notification {
  id: number; userId: string | null; type: string; title: string; message: string;
  read: boolean; sentAt: string;
}

const NOTIFICATION_TYPES = ["credit_low", "credit_expired", "payment_failed", "payment_success", "plan_expiring", "system", "promo", "audit_complete", "competitor_complete", "graphics_complete", "team_invite", "new_user", "new_purchase", "new_team"];

function fetchNotifications(type: string): Promise<{ notifications: Notification[] }> {
  const params = type ? `?type=${type}` : "";
  return fetch(`/api/admin/notifications${params}`).then((r) => r.json());
}

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({ userId: "", type: "system", title: "", message: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-notifications", typeFilter],
    queryFn: () => fetchNotifications(typeFilter === "all" ? "" : typeFilter),
  });
  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  const send = useMutation({
    mutationFn: (body: object) => fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); setOpen(false); setForm({ userId: "", type: "system", title: "", message: "" }); },
  });

  const markRead = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/notifications/${id}`, { method: "DELETE" }).then((r) => r.ok),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unread > 0 && <Badge>{unread} unread</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Send Alert</Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {NOTIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No notifications found.</TableCell></TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n.id} className={n.read ? "opacity-60" : ""}>
                      <TableCell><Badge variant="outline" className="capitalize">{n.type.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="font-medium">{n.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{n.message}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">{n.userId || <span className="text-muted-foreground">Broadcast</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(n.sentAt).toLocaleString()}</TableCell>
                      <TableCell>{n.read ? <Badge variant="secondary">Read</Badge> : <Badge>Unread</Badge>}</TableCell>
                      <TableCell className="text-right">
                        {!n.read && <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}><Check className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(n.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="User ID (leave blank for broadcast)" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => send.mutate({ userId: form.userId || null, type: form.type, title: form.title, message: form.message })} disabled={!form.title || !form.message}>Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
