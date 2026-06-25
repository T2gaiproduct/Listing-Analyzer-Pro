import { useState } from "react";
import {
  FilePlus2,
  FileSearch,
  Palette,
  Video,
  Megaphone,
  Bell,
  Users,
  ChevronRight,
  Zap,
  UserCircle,
  Receipt,
  Settings,
  HelpCircle,
  CreditCard,
  LogOut,
  X,
  Archive,
  PanelLeftClose,
} from "lucide-react";

const navItems = [
  { icon: FilePlus2, label: "Create Listings", active: true },
  { icon: FileSearch, label: "Audit Listings", active: false },
  { icon: Palette, label: "Create Graphics", active: false },
  { icon: Video, label: "Create Videos", active: false },
  { icon: Megaphone, label: "Manage Ads", active: false },
];

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile", href: "/profile" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: HelpCircle, label: "Help & Support", href: "/help" },
];

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
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

export function CustomerSidebar() {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-slate-100 flex items-center justify-center p-8"
      onClick={() => setProfileOpen(false)}
    >
      {/* Sidebar */}
      <div
        className="relative flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-visible"
        style={{ width: 260, height: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Logo left | Notification + Archive + Slider right */}
        <div className="px-4 py-4 border-b border-slate-100 flex items-center" style={{ overflow: "visible" }}>
          {/* Logo only */}
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Notification */}
          <Tooltip label="Notifications">
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-500" />
            </button>
          </Tooltip>

          {/* Archive */}
          <Tooltip label="Archive">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1">
              <Archive className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-2" />

          {/* Sidebar toggle */}
          <Tooltip label="Collapse Sidebar">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Nav Links + My Projects */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col gap-0">
          {/* Main nav */}
          <div className="space-y-0.5">
            {navItems.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                  active
                    ? "bg-orange-50 text-orange-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? "text-orange-500" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="flex-1 text-left">{label}</span>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* My Projects section */}
          <div className="mt-5">
            <div className="flex items-center gap-1 px-3 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-1">
                My Projects
              </span>
              <ChevronRight className="w-3 h-3 text-slate-300 rotate-90" />
            </div>
            <div className="space-y-0.5">
              {[
                { label: "Nike Shoe Listing Q4", active: true },
                { label: "Wireless Earbuds Audit" },
                { label: "Summer Apparel Graphics" },
                { label: "Brand Video — Oct 2025" },
                { label: "Sponsored Ads — ASIN B09X" },
                { label: "Kitchen Bundle Listing" },
                { label: "Pet Supplies Audit" },
              ].map(({ label, active }) => (
                <button
                  key={label}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left group ${
                    active
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 group-hover:bg-orange-400 transition-colors" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Profile popup — anchored above the footer */}
        {profileOpen && (
          <div
            className="absolute left-3 right-3 bottom-[76px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
          >
            {/* Popup header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">
                TE
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">temp</p>
                <p className="text-xs text-slate-400 leading-tight">temp@example.com</p>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              {profileMenuItems.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Divider + Log out */}
            <div className="border-t border-slate-100 py-1.5">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Bottom Footer — Profile (left) + Upgrade (right) */}
        <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between gap-3 rounded-b-2xl">
          {/* My Profile — click to toggle popup */}
          <button
            className={`flex items-center gap-2.5 min-w-0 transition-opacity rounded-xl px-1 py-1 -mx-1 ${
              profileOpen ? "bg-slate-50" : "hover:bg-slate-50"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((prev) => !prev);
            }}
          >
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none ring-2 ring-transparent hover:ring-orange-200 transition-all">
              TE
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">
                temp
              </p>
              <p className="text-xs text-slate-400 leading-tight">Free</p>
            </div>
          </button>

          {/* Upgrade button */}
          <button className="flex-shrink-0 text-sm font-medium text-slate-700 border border-slate-300 rounded-full px-4 py-1.5 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
