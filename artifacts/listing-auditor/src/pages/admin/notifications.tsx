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
import { Bell, Megaphone, Plus, Trash2, Check, RefreshCw, Save, Filter } from "lucide-react";
import { ResponsiveTable } from "@/components/responsive-table";
import { useToast } from "@/hooks/use-toast";
import { NotificationPreferencesCard } from "@/components/notification-preferences-card";
import {
  ANNOUNCEMENT_PROMO_CATEGORY,
  ANNOUNCEMENT_PROMO_KEYS,
  announcementPromoFormDefaults,
} from "@/lib/announcement-promo";
import {
  ADMIN_NOTIFICATION_TYPES_BY_CATEGORY,
  NOTIFICATION_CATEGORY_FILTER_OPTIONS,
  NOTIFICATION_CATEGORY_LABELS,
} from "@/lib/notification-preferences";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Notification {
  id: number;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  sentAt: string;
  category?: string;
  userWouldSee?: boolean | null;
}

interface NotificationFilters {
  category: string;
  read: string;
}

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

function fetchNotifications(filters: NotificationFilters): Promise<{ notifications: Notification[] }> {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.read && filters.read !== "all") params.set("read", filters.read);
  const qs = params.toString();
  return fetch(`${basePath}/api/admin/notifications${qs ? `?${qs}` : ""}`, { credentials: "include" }).then((r) => r.json());
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>({ category: "all", read: "all" });
  const [form, setForm] = useState({
    userId: "",
    category: "system",
    type: "system",
    title: "",
    message: "",
    force: false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-notifications", filters],
    queryFn: () => fetchNotifications(filters),
  });
  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const filteredByPrefs = notifications.filter((n) => n.userId && n.userWouldSee === false).length;

  const sendTypes = ADMIN_NOTIFICATION_TYPES_BY_CATEGORY[form.category] ?? ["system"];

  const send = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/admin/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to send");
        return data;
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      setOpen(false);
      setForm({ userId: "", category: "system", type: "system", title: "", message: "", force: false });
      if (data?.skipped) {
        toast({
          title: "Notification skipped",
          description: "This user turned off that category in their notification preferences.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Notification sent" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">User notification log</p>
            {unread > 0 && <Badge>{unread} unread</Badge>}
            {filteredByPrefs > 0 && (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                {filteredByPrefs} hidden by user prefs
              </Badge>
            )}
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

        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </div>
          <Select
            value={filters.category}
            onValueChange={(v) => setFilters((p) => ({ ...p, category: v }))}
          >
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_CATEGORY_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.read}
            onValueChange={(v) => setFilters((p) => ({ ...p, read: v }))}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="unread">Unread only</SelectItem>
              <SelectItem value="read">Read only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border min-w-0">
          <ResponsiveTable minWidth="52rem">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>User sees?</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No notifications found.</TableCell></TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n.id} className={n.read ? "opacity-60" : ""}>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {NOTIFICATION_CATEGORY_LABELS[n.category ?? "other"] ?? n.category ?? "Other"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{n.type.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[160px] truncate">{n.title}</TableCell>
                      <TableCell className="max-w-[100px] truncate text-xs">{n.userId || <span className="text-muted-foreground">Broadcast</span>}</TableCell>
                      <TableCell>
                        {n.userId == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : n.userWouldSee ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200 text-xs">Filtered off</Badge>
                        )}
                      </TableCell>
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
            <Input
              placeholder="User ID (leave blank for broadcast log only)"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
            />
            <Select
              value={form.category}
              onValueChange={(v) => {
                const types = ADMIN_NOTIFICATION_TYPES_BY_CATEGORY[v] ?? ["system"];
                setForm({ ...form, category: v, type: types[0] });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {Object.keys(ADMIN_NOTIFICATION_TYPES_BY_CATEGORY).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {NOTIFICATION_CATEGORY_LABELS[cat] ?? cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sendTypes.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} />
            {form.userId.trim() && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Force delivery</p>
                  <p className="text-xs text-muted-foreground">Bypass the user&apos;s notification category toggles</p>
                </div>
                <Switch checked={form.force} onCheckedChange={(checked) => setForm({ ...form, force: checked })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => send.mutate({
                userId: form.userId.trim() || null,
                type: form.type,
                title: form.title,
                message: form.message,
                force: form.force,
              })}
              disabled={!form.title || !form.message || send.isPending}
            >
              Send
            </Button>
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
          <TabsTrigger value="preferences">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Your preferences
          </TabsTrigger>
        </TabsList>
        <TabsContent value="promo" className="mt-4">
          <PromoBannerEditor />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationLog />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4 max-w-2xl">
          <NotificationPreferencesCard />
          <p className="text-xs text-muted-foreground mt-3">
            These settings apply to your admin account the same way as the customer dashboard — in-app alerts, toast notifications, and email.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
