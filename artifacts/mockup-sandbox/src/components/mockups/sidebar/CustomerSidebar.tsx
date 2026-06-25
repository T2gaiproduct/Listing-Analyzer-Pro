import { useState, useRef, useEffect } from "react";
import {
  FilePlus2,
  FileSearch,
  Palette,
  Video,
  Megaphone,
  Bell,
  ChevronDown,
  Zap,
  UserCircle,
  Receipt,
  Settings,
  HelpCircle,
  Users,
  LogOut,
  X,
  Archive,
  PanelLeftClose,
  Pin,
  MoreHorizontal,
  Share2,
  PenLine,
  Trash2,
} from "lucide-react";

const navItems = [
  { icon: FilePlus2, label: "Create Listings", active: true },
  { icon: FileSearch, label: "Audit Listings", active: false },
  { icon: Palette, label: "Create Graphics", active: false },
  { icon: Video, label: "Create Videos", active: false },
  { icon: Megaphone, label: "Manage Ads", active: false },
];

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile" },
  { icon: Receipt, label: "Billing" },
  { icon: Users, label: "Team" },
  { icon: Settings, label: "Settings" },
  { icon: HelpCircle, label: "Help & Support" },
];

const projectList = [
  "Nike Shoe Listing Q4",
  "Wireless Earbuds Audit",
  "Summer Apparel Graphics",
  "Brand Video — Oct 2025",
  "Sponsored Ads — ASIN B09X",
  "Kitchen Bundle Listing",
  "Pet Supplies Audit",
  "Holiday Gift Set Campaign",
  "Vitamin Gummies SEO Audit",
  "Outdoor Gear Graphics Pack",
  "Electronics Category Ads",
  "Baby Products Listing",
  "Home Decor Brand Video",
  "Fitness Tracker Audit",
  "Office Supplies Q1 Listing",
  "Skincare Bundle Graphics",
  "Sports Equipment Ads",
  "Toy Category Listing",
];

const contextMenuOptions = [
  { icon: Share2, label: "Share" },
  { icon: PenLine, label: "Rename" },
  { icon: Pin, label: "Pin project" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete", danger: true },
];

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-slate-800 rounded-md whitespace-nowrap z-50 pointer-events-none shadow-lg">
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
          {label}
        </div>
      )}
    </div>
  );
}

function ProjectItem({
  label,
  isFirst,
  openMenu,
  setOpenMenu,
  id,
}: {
  label: string;
  isFirst: boolean;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  id: string;
}) {
  const [hovered, setHovered] = useState(false);
  const menuOpen = openMenu === id;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, setOpenMenu]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors group ${
          hovered || menuOpen ? "bg-slate-100" : ""
        } ${isFirst ? "text-slate-900 font-medium" : "text-slate-600"}`}
      >
        <span className="truncate flex-1 text-left">{label}</span>
        {/* Pin + 3-dot shown on hover */}
        {(hovered || menuOpen) && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
              <Pin className="w-3 h-3" />
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(menuOpen ? null : id);
              }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Context menu dropdown */}
      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        >
          {contextMenuOptions.map(({ icon: Icon, label: optLabel, danger }) => (
            <button
              key={optLabel}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                danger
                  ? "text-red-500 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setOpenMenu(null)}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${danger ? "text-red-400" : "text-slate-400"}`} />
              {optLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerSidebar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8" onClick={() => { setProfileOpen(false); setOpenMenu(null); }}>
      {/* Sidebar */}
      <div
        className="relative flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-visible"
        style={{ width: 260, height: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 flex items-center" style={{ overflow: "visible" }}>
          <a
            href="/dashboard"
            title="Go to Dashboard"
            className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0 hover:bg-orange-600 transition-colors"
          >
            <Zap className="w-4 h-4 text-white" />
          </a>
          <div className="flex-1" />
          <Tooltip label="Notifications">
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-500" />
            </button>
          </Tooltip>
          <Tooltip label="Archive">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1">
              <Archive className="w-4 h-4" />
            </button>
          </Tooltip>
          <div className="w-px h-5 bg-slate-200 mx-2" />
          <Tooltip label="Collapse Sidebar">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Nav + Projects scroll area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0">
          {/* Main nav */}
          <div className="space-y-0.5">
            {navItems.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors group ${
                  active
                    ? "bg-orange-50 text-orange-600"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-orange-500" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span className="flex-1 text-left">{label}</span>
              </button>
            ))}
          </div>

          {/* Divider before My Projects */}
          <div className="my-4 border-t border-slate-100" />

          {/* My Projects header */}
          <button
            className="flex items-center gap-1.5 px-3 mb-2 w-full group"
            onClick={() => setProjectsOpen((p) => !p)}
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex-1 text-left">
              My Projects
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                projectsOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>

          {/* Project list — scrollable within nav area */}
          {projectsOpen && (
            <div className="space-y-0.5">
              {projectList.map((label, i) => (
                <ProjectItem
                  key={label}
                  id={label}
                  label={label}
                  isFirst={i === 0}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                />
              ))}
            </div>
          )}
        </div>

        {/* Profile popup */}
        {profileOpen && (
          <div
            className="absolute left-3 right-3 bottom-[76px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">TE</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">temp</p>
                <p className="text-xs text-slate-400 leading-tight">temp@example.com</p>
              </div>
              <button onClick={() => setProfileOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-1.5">
              {profileMenuItems.map(({ icon: Icon, label }) => (
                <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Bottom footer */}
        <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between gap-3 rounded-b-2xl flex-shrink-0">
          <button
            className={`flex items-center gap-2.5 min-w-0 rounded-xl px-1 py-1 -mx-1 ${profileOpen ? "bg-slate-50" : "hover:bg-slate-50"}`}
            onClick={(e) => { e.stopPropagation(); setProfileOpen((p) => !p); }}
          >
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">TE</div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">temp</p>
              <p className="text-xs text-slate-400 leading-tight">Free</p>
            </div>
          </button>
          <button className="flex-shrink-0 text-sm font-medium text-slate-700 border border-slate-300 rounded-full px-4 py-1.5 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
