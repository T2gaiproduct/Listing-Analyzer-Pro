import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Megaphone, Plus, Trash2, Check, RefreshCw, Save } from "lucide-react";
import { ResponsiveTable } from "@/components/responsive-table";
import { useToast } from "@/hooks/use-toast";
import {
  ANNOUNCEMENT_PROMO_CATEGORY,
  ANNOUNCEMENT_PROMO_KEYS,
  announcementPromoFormDefaults,
} from "@/lib/announcement-promo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Notification {
  id: number; userId: string | null; type: string; title: string; message: string;
  read: boolean; sentAt: string;
}

const NOTIFICATION_TYPES = ["credit_low", "credit_expired", "payment_failed", "payment_success", "plan_expiring", "system", "promo"];

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, settings }),
  }).then((r) => r.json());
}

function fetchNotifications(type: string): Promise<{ notifications: Notification[] }> {
  const params = type ? `?type=${type}` : "";
  return fetch(`${basePath}/api/admin/notifications${params}`, { credentials: "include" }).then((r) => r.json());
}

function PromoBannerEditor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>(() => announcementPromoFormDefaults());
  const [dirty, setDirty] = useState(false);

  const { isLoading, data: settings } = useQuery({
    queryKey: ["admin-announcement-promo"],
    queryFn: () => fetchSettings(ANNOUNCEMENT_PROMO_CATEGORY),
  });

  useEffect(() => {
    if (settings && !dirty) {
      setForm(announcementPromoFormDefaults(settings));
    }
  }, [settings, dirty]);

  const saveMutation = useMutation({
    mutationFn: () => saveSettings(ANNOUNCEMENT_PROMO_CATEGORY, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcement-promo"] });
      qc.invalidateQueries({ queryKey: ["announcement-promo"] });
      setDirty(false);
      toast({ title: "Promo banner saved", description: "The homepage announcement bar is updated." });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const enabled = form[ANNOUNCEMENT_PROMO_KEYS.enabled] !== "false";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Homepage promo banner</CardTitle>
        <CardDescription>
          The dark bar at the top of the public homepage. Manage promo text, coupon code, and link here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Show promo banner</p>
            <p className="text-xs text-slate-500 mt-0.5">Visitors can dismiss it for their browser session.</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => updateField(ANNOUNCEMENT_PROMO_KEYS.enabled, checked ? "true" : "false")}
          />
        </div>

        <div>
          <Label className="text-xs text-slate-500">Promo text (before code)</Label>
          <Input
            className="mt-1"
            value={form[ANNOUNCEMENT_PROMO_KEYS.text] ?? ""}
            onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.text, e.target.value)}
            placeholder="Launch offer: Get 20% off any plan with code"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Promo code</Label>
            <Input
              className="mt-1 font-mono"
              value={form[ANNOUNCEMENT_PROMO_KEYS.code] ?? ""}
              onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.code, e.target.value)}
              placeholder="LAUNCH20"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Link text</Label>
            <Input
              className="mt-1"
              value={form[ANNOUNCEMENT_PROMO_KEYS.linkText] ?? ""}
              onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.linkText, e.target.value)}
              placeholder="See pricing"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-500">Link URL</Label>
          <Input
            className="mt-1"
            value={form[ANNOUNCEMENT_PROMO_KEYS.linkUrl] ?? ""}
            onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.linkUrl, e.target.value)}
            placeholder="/pricing"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-900 text-white text-sm py-2.5 px-4">
          <span className="text-orange-400 font-semibold">{form[ANNOUNCEMENT_PROMO_KEYS.text] || "Promo text"}</span>{" "}
          <code className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono text-xs">
            {form[ANNOUNCEMENT_PROMO_KEYS.code] || "CODE"}
          </code>
          {form[ANNOUNCEMENT_PROMO_KEYS.linkText] && (
            <span className="ml-2 text-orange-300 underline">{form[ANNOUNCEMENT_PROMO_KEYS.linkText]}</span>
          )}
        </div>

        <Button
          className="bg-orange-500 hover:bg-orange-600"
          disabled={!dirty || saveMutation.isPending || isLoading}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save promo banner
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationLog() {
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
    mutationFn: (body: object) => fetch(`${basePath}/api/admin/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); setOpen(false); setForm({ userId: "", type: "system", title: "", message: "" }); },
  });

  const markRead = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/notifications/${id}/read`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/notifications/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.ok),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  return (
    <>
      <Card className="p-3 sm:p-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900">User notification log</p>
            {unread > 0 && <Badge>{unread} unread</Badge>}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" className="flex-1 sm:flex-none min-h-11" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Send alert
            </Button>
            <Button variant="outline" size="sm" className="min-h-11 min-w-11 px-0 sm:px-3" onClick={() => refetch()} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {NOTIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border min-w-0">
          <ResponsiveTable minWidth="44rem">
            <table className="w-full caption-bottom text-sm">
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
            </table>
          </ResponsiveTable>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send notification</DialogTitle></DialogHeader>
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
    </>
  );
}

export default function AdminNotifications() {
  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 flex-shrink-0" />
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Announcements</h1>
      </div>

      <Tabs defaultValue="promo">
        <TabsList>
          <TabsTrigger value="promo">Promo banner</TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            User alerts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="promo" className="mt-4">
          <PromoBannerEditor />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
