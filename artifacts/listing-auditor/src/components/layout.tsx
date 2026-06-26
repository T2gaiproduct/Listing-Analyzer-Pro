import { ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useActionDialog } from "@/components/ui/action-dialog";
import { Link, useLocation } from "wouter";
import {
  FilePlus2,
  FileSearch,
  Palette,
  Video,
  Megaphone,
  Bell,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  LogOut,
  Shield,
  UserCircle,
  Receipt,
  Settings,
  HelpCircle,
  Users,
  X,
  Pin,
  MoreHorizontal,
  Share2,
  PenLine,
  Trash2,
  Zap,
  LifeBuoy,
  FileText,
  Download,
  Keyboard,
  ScrollText,
  Lock,
  Bug,
  Folder,
  Search,
  FileText as AuditIcon,
  Image as GraphicsIcon,
  Clapperboard as VideoIcon,
  Target as AdsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser, useClerk } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useGetRecents, getGetRecentsQueryKey } from "@workspace/api-client-react";
import type { RecentItem } from "@workspace/api-client-react";

const adminUserIds = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const mainNavItems = [
  { icon: FilePlus2, label: "Create Listings", href: "/audits/new" },
  { icon: FileSearch, label: "Audit Listings", href: "/audit-listings" },
  { icon: Palette, label: "Create Graphics", href: "/projects" },
  { icon: Video, label: "Create Videos", href: "/videos" },
  { icon: Megaphone, label: "Manage Ads", href: "/ads" },
];

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile", href: "/profile" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const helpSubmenuItems = [
  { icon: LifeBuoy,   label: "Help center",         href: "/help" },
  { icon: FileText,   label: "Release notes",        href: "/help#release" },
  { icon: Download,   label: "Download apps",        href: "/help#apps" },
  { icon: Keyboard,   label: "Keyboard shortcuts",   href: "/help#shortcuts" },
  { icon: ScrollText, label: "Terms of Service",     href: "/terms" },
  { icon: Lock,       label: "Privacy Policy",       href: "/privacy" },
  { icon: Bug,        label: "Report a bug",         href: "/contact" },
];

const contextMenuOptions = [
  { icon: Share2, label: "Share" },
  { icon: PenLine, label: "Rename" },
  { icon: Pin, label: "Pin project" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete", danger: true },
];

// --- Tooltip ----------------------------------------------------------------
function SidebarTooltip({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "bottom" | "right" }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className="flex items-center cursor-pointer">{children}</div>
      </TooltipTrigger>
      <TooltipContent side={side} className="bg-slate-900 text-white border-slate-800 text-xs font-medium px-2 py-1.5 rounded-md shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// --- Notification bell in header --------------------------------------------
interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  sentAt: string;
}

function NotificationIcon({ collapsed }: { collapsed: boolean }) {
  const [, navigate] = useLocation();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<{ notifications: NotificationItem[] }> => {
      const r = await fetch(`${basePath}/api/notifications`);
      if (!r.ok) throw new Error("Failed to load notifications");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SidebarTooltip label="Notifications" side={collapsed ? "right" : "bottom"}>
      <button
        onClick={() => navigate("/notifications")}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-colors text-slate-500 hover:text-slate-800 hover:bg-slate-100",
          collapsed ? "w-9 h-9" : "w-8 h-8"
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-white" />
        )}
      </button>
    </SidebarTooltip>
  );
}

// --- Type icon mapping for recent projects ----------------------------------
const typeIconMap: Record<string, typeof AuditIcon> = {
  audit: AuditIcon,
  graphics: GraphicsIcon,
  video: VideoIcon,
  ads: AdsIcon,
};

const typeLabelMap: Record<string, string> = {
  audit: "Audit",
  graphics: "Graphics",
  video: "Video",
  ads: "Ads",
};

// --- Recent project item with type icon and context menu --------------------
function RecentProjectItem({
  item,
  openMenu,
  setOpenMenu,
  onPin,
  onRename,
  onArchive,
  onDelete,
}: {
  item: RecentItem;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  onPin: () => void;
  onRename: (name: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [location] = useLocation();
  const [hovered, setHovered] = useState(false);
  const key = `${item.type}-${item.id}`;
  const menuOpen = openMenu === key;
  const ref = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const isActive = location === item.url;
  const TypeIcon = typeIconMap[item.type] || AuditIcon;
  const { trigger, dialog } = useActionDialog();

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest?.("[data-recent-menu]")
      ) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, setOpenMenu]);

  function openDropdown(e: React.MouseEvent) {
    e.stopPropagation();
    if (menuOpen) { setOpenMenu(null); return; }
    const rect = dotsRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    setOpenMenu(key);
  }

  function handleMenuAction(label: string) {
    setOpenMenu(null);
    if (label === "Pin project") { onPin(); return; }
    if (label === "Rename") {
      trigger(
        async (name) => { await onRename(name); },
        {
          title: "Rename Project",
          description: "Enter a new name for this project.",
          confirmLabel: "Rename",
          successTitle: "Renamed!",
          successDescription: "Your project has been renamed successfully.",
          inputField: { label: "Project name", placeholder: "Enter name…", defaultValue: item.name },
        }
      );
      return;
    }
    if (label === "Archive") {
      trigger(
        async () => { await onArchive(); },
        {
          title: "Archive this project?",
          description: "It will be moved to your Archive. You can restore it anytime.",
          confirmLabel: "Archive",
          successTitle: "Archived!",
          successDescription: "Your project has been moved to the Archive.",
        }
      );
      return;
    }
    if (label === "Delete") {
      trigger(
        async () => { await onDelete(); },
        {
          title: "Delete this project?",
          description: "This action cannot be undone.",
          confirmLabel: "Delete",
          confirmVariant: "destructive",
          successTitle: "Deleted",
          successDescription: "Your project has been permanently deleted.",
        }
      );
      return;
    }
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
          isActive
            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
            : hovered || menuOpen
            ? "bg-sidebar-accent/40 text-sidebar-foreground/90"
            : "text-sidebar-foreground/60"
        )}
      >
        <TypeIcon className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />

        <Link href={item.url} className="truncate flex-1 text-left min-w-0">
          {item.name}
        </Link>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(hovered || menuOpen || item.pinned) && (
            <button
              title={item.pinned ? "Unpin" : "Pin"}
              className={cn(
                "w-5 h-5 flex items-center justify-center rounded transition-colors",
                item.pinned
                  ? "text-primary hover:text-primary/70"
                  : "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
              onClick={(e) => { e.stopPropagation(); onPin(); }}
            >
              <Pin className={cn("w-3 h-3", item.pinned ? "fill-current" : "")} />
            </button>
          )}
          <button
            ref={dotsRef}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded transition-colors",
              menuOpen
                ? "text-sidebar-foreground bg-sidebar-accent/60"
                : "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
            onClick={openDropdown}
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>

      {menuOpen && menuPos && createPortal(
        <div
          data-recent-menu
          style={{ position: "fixed", top: menuPos.top, left: Math.max(4, menuPos.left), zIndex: 9999 }}
          className="w-44 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden py-1"
        >
          {contextMenuOptions.map(({ icon: Icon, label: optLabel, danger }) => (
            <button
              key={optLabel}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
              )}
              onClick={(e) => { e.stopPropagation(); handleMenuAction(optLabel); }}
            >
              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
              {optLabel === "Pin project" ? (item.pinned ? "Unpin" : "Pin project") : optLabel}
            </button>
          ))}
        </div>,
        document.body
      )}

      {dialog}
    </div>
  );
}

// --- Page title map ---------------------------------------------------------
function getPageTitle(location: string): string {
  if (location === "/" || location === "/dashboard") return "Dashboard";
  if (location === "/audits/new") return "Create Listing";
  if (location === "/audits/workflow") return "Create Listing";
  if (location.startsWith("/audits/") && location.includes("/competitors/")) return "Add Competitor";
  if (location.startsWith("/audits/")) return "Audit Details";
  if (location === "/audit-listings") return "Audit Listings";
  if (location === "/projects/create") return "New Graphics Project";
  if (location.endsWith("/generating")) return "Generating Graphics";
  if (location.startsWith("/projects/")) return "Project Details";
  if (location === "/projects") return "Create Graphics";
  if (location === "/videos") return "Create Videos";
  if (location === "/ads") return "Manage Ads";
  if (location === "/billing") return "Billing";
  if (location === "/profile") return "Profile";
  if (location === "/settings") return "Settings";
  if (location === "/team") return "Team";
  if (location === "/notifications") return "Notifications";
  if (location === "/archive") return "Archive";
  return "ListingAuditor";
}

// --- Main Layout ------------------------------------------------------------
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const isAdmin = user ? adminUserIds.includes(user.id) : false;

  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const helpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const recentsQueryKey = getGetRecentsQueryKey({ limit: 200 });

  function invalidateRecents() {
    void queryClient.invalidateQueries({ queryKey: recentsQueryKey });
  }

  const pinMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, id }),
      });
      return r.json();
    },
    onSuccess: invalidateRecents,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ type, id, name }: { type: string; id: number; name: string }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      return r.json();
    },
    onSuccess: invalidateRecents,
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      return r.json();
    },
    onSuccess: () => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const r = await fetch(`${basePath}/api/projects/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return r.json();
    },
    onMutate: async ({ type, id }) => {
      await queryClient.cancelQueries({ queryKey: recentsQueryKey });
      const prev = queryClient.getQueryData(recentsQueryKey);
      queryClient.setQueryData(recentsQueryKey, (old: { items: RecentItem[] } | undefined) => ({
        items: (old?.items ?? []).filter((i) => !(i.type === type && i.id === id)),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(recentsQueryKey, ctx.prev);
    },
    onSettled: () => {
      invalidateRecents();
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });

  // Fetch unified recents for sidebar
  const { data: recentsData } = useGetRecents({ limit: 200 });
  const recents = (recentsData?.items ?? []) as RecentItem[];

  // Search projects
  const { data: searchData } = useQuery({
    queryKey: ["search-projects", searchQuery],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/search/projects?q=${encodeURIComponent(searchQuery)}&limit=50`);
      if (!r.ok) return { items: [] };
      return r.json() as Promise<{ items: RecentItem[] }>;
    },
    enabled: searchQuery.length > 0,
  });
  const searchResults = (searchData?.items ?? []) as RecentItem[];

  const displayItems = searchQuery.length > 0 ? searchResults : recents;

  // Close profile popup on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?";

  const displayName = user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account";
  const planLabel = "Free"; // Can be wired to subscription API later

  return (
    <div
      className="flex h-screen w-full bg-background overflow-hidden"
      onClick={() => { setProfileOpen(false); setOpenMenu(null); }}
    >
      {/* Sidebar */}
      <TooltipProvider>
        <aside
          className={cn(
            "flex-shrink-0 bg-white text-slate-800 border-r border-slate-200 flex flex-col shadow-2xl z-10 transition-all duration-200 overflow-y-auto overflow-x-visible",
            collapsed ? "w-16" : "w-64"
          )}
          onClick={(e) => e.stopPropagation()}
        >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "border-b border-sidebar-border/50 flex-shrink-0",
            collapsed ? "px-2 py-3 flex flex-col items-center gap-2" : "px-4 py-4 flex items-center"
          )}
        >
          {/* Logo */}
          <Link href="/dashboard">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
              <Zap className="w-4 h-4 text-white" />
            </div>
          </Link>

          {!collapsed && (
            <>
              <div className="flex-1" />

              {/* Notifications */}
              <NotificationIcon collapsed={false} />

              {/* Archive */}
              <SidebarTooltip label="Archive" side="bottom">
                <Link href="/archive">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ml-1">
                    <Archive className="w-4 h-4" />
                  </button>
                </Link>
              </SidebarTooltip>

              {/* Divider */}
              <div className="w-px h-5 bg-sidebar-border/60 mx-2" />

              {/* Collapse */}
              <SidebarTooltip label="Collapse Sidebar" side="bottom">
                <button
                  onClick={() => setCollapsed(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </SidebarTooltip>
            </>
          )}

          {/* Expand button — sits below logo when collapsed */}
          {collapsed && (
            <SidebarTooltip label="Expand Sidebar" side="right">
              <button
                onClick={() => setCollapsed(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 border border-sidebar-border/60 transition-colors"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </SidebarTooltip>
          )}
        </div>

        {/* ── Nav + Projects (scrollable) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-visible py-4 flex flex-col">
          {/* Search bar — only when expanded */}
          {!collapsed && (
            <div className="px-3 mb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full h-8 pl-8 pr-3 rounded-lg text-xs bg-sidebar-accent/50 border border-sidebar-border/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Main nav items */}
          <div className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")}>
            {mainNavItems.map(({ icon: Icon, label, href }) => {
              const isActive = location === href || (href === "/dashboard" && location === "/");
              if (collapsed) {
                return (
                  <SidebarTooltip key={href} label={label} side="right">
                    <Link href={href}>
                      <button
                        className={cn(
                          "w-full flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-primary"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    </Link>
                  </SidebarTooltip>
                );
              }
              return (
                <Link key={href} href={href}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left",
                      isActive
                        ? "bg-sidebar-accent text-slate-900 font-semibold"
                        : "text-sidebar-foreground/60 font-medium hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* My Projects icon — collapsed mode only */}
          {collapsed && (
            <div className="px-2 mt-1">
              <SidebarTooltip label="Recent Projects" side="right">
                <button
                  className="w-full flex items-center justify-center h-10 rounded-xl transition-colors text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => setCollapsed(false)}
                >
                  <Folder className="w-5 h-5" />
                </button>
              </SidebarTooltip>
            </div>
          )}

          {/* Recent Projects section — only when expanded */}
          {!collapsed && (
            <>
              <div className="mx-3 my-4 border-t border-sidebar-border/50" />

              <div className="px-3">
                <button
                  className="flex items-center gap-2 px-3 mb-2 w-full group"
                  onClick={() => setProjectsOpen((p) => !p)}
                >
                  <Folder className="w-3.5 h-3.5 text-sidebar-foreground/40" />
                  <span className="text-xs font-bold text-sidebar-foreground/50 uppercase tracking-wider flex-1 text-left">
                    {searchQuery ? "Search Results" : "Recent Projects"}
                  </span>
                  <span className="text-xs text-sidebar-foreground/30 tabular-nums">{displayItems.length}</span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform duration-200",
                      projectsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>

                {projectsOpen && (
                  <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                    {displayItems.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-sidebar-foreground/40 italic">
                        {searchQuery ? "No matches found" : "No projects yet"}
                      </p>
                    ) : (
                      displayItems.map((item) => (
                        <RecentProjectItem
                          key={`${item.type}-${item.id}`}
                          item={item}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onPin={() => pinMutation.mutate({ type: item.type, id: item.id })}
                          onRename={(name) => renameMutation.mutateAsync({ type: item.type, id: item.id, name })}
                          onArchive={() => archiveMutation.mutateAsync({ type: item.type, id: item.id })}
                          onDelete={() => deleteMutation.mutateAsync({ type: item.type, id: item.id })}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Admin Panel */}
          {isAdmin && (
            <div className={cn("mt-2", collapsed ? "px-2" : "px-3")}>
              {collapsed ? (
                <SidebarTooltip label="Admin Panel" side="right">
                  <Link href="/admin/dashboard">
                    <button className="w-full flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-primary transition-colors">
                      <Shield className="w-4 h-4 text-primary" />
                    </button>
                  </Link>
                </SidebarTooltip>
              ) : (
                <Link href="/admin/dashboard">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Admin Panel
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: Profile + Upgrade ──────────────────────── */}
        <div
          className={cn(
            "border-t border-sidebar-border/50 flex-shrink-0",
            collapsed ? "px-2 py-3 flex justify-center" : "px-4 py-4 flex items-center justify-between gap-3"
          )}
        >
          {collapsed ? (
            /* Collapsed: just avatar */
            <SidebarTooltip label={displayName} side="right">
              <button
                onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
                className="w-9 h-9 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              >
                {initials}
              </button>
            </SidebarTooltip>
          ) : (
            <>
              {/* Profile button */}
              <div ref={profileRef} className="relative min-w-0">
                <button
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-1 py-1 -mx-1 transition-colors min-w-0",
                    profileOpen ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent/50"
                  )}
                  onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-sidebar-foreground leading-tight truncate max-w-[90px]">
                      {displayName}
                    </p>
                    <p className="text-xs text-sidebar-foreground/50 leading-tight">{planLabel}</p>
                  </div>
                </button>

                {/* Profile popup */}
                {profileOpen && (
                  <div
                    className="absolute left-0 bottom-full mb-3 w-56 bg-popover border border-border rounded-2xl shadow-2xl z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3 rounded-t-2xl overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground leading-tight truncate">
                          {user?.emailAddresses?.[0]?.emailAddress ?? ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setProfileOpen(false)}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Menu items */}
                    <div className="py-1.5">
                      {profileMenuItems.map(({ icon: Icon, label, href }) => (
                        <Link key={label} href={href}>
                          <button
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            {label}
                          </button>
                        </Link>
                      ))}

                      {/* Help & Support — flyout on hover */}
                      <div
                        className="relative"
                        onMouseEnter={() => {
                          if (helpTimeoutRef.current) clearTimeout(helpTimeoutRef.current);
                          setHelpOpen(true);
                        }}
                        onMouseLeave={() => {
                          helpTimeoutRef.current = setTimeout(() => setHelpOpen(false), 120);
                        }}
                      >
                        <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left">
                          <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1">Help &amp; Support</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>

                        {/* Flyout submenu */}
                        {helpOpen && (
                          <div
                            className="absolute left-full bottom-0 ml-1 w-52 bg-popover border border-border rounded-xl shadow-2xl z-[110] py-1.5"
                            onMouseEnter={() => {
                              if (helpTimeoutRef.current) clearTimeout(helpTimeoutRef.current);
                              setHelpOpen(true);
                            }}
                            onMouseLeave={() => {
                              helpTimeoutRef.current = setTimeout(() => setHelpOpen(false), 120);
                            }}
                          >
                            {helpSubmenuItems.map(({ icon: Icon, label, href }) => (
                              <Link key={label} href={href}>
                                <button
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                                  onClick={() => { setHelpOpen(false); setProfileOpen(false); }}
                                >
                                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  {label}
                                </button>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border py-1.5 rounded-b-2xl overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                        onClick={() => signOut({ redirectUrl: `${basePath}/` })}
                      >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upgrade button */}
              <Link href="/billing">
                <button className="flex-shrink-0 text-sm font-medium text-sidebar-foreground/80 border border-sidebar-border rounded-full px-4 py-1.5 hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors">
                  Upgrade
                </button>
              </Link>
            </>
          )}
        </div>
        </aside>
      </TooltipProvider>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-orange-300 flex-shrink-0" />

        {/* ── Top ribbon ── */}
        <div className="flex items-center h-[52px] px-8 bg-white border-b border-slate-200 flex-shrink-0">
          <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
            {getPageTitle(location)}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
