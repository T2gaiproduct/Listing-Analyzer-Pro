import type { AdminPermission } from "@workspace/admin-permissions";
import {
  Users, FileText, BarChart2, CreditCard,
  Layers, Shield,
  BadgePercent, ClipboardList,
  Bot, KeyRound, Lock, Wallet,
  Globe, BookOpen, TrendingUp, MessageSquare, Image, Navigation, Home,
  Settings, FileSearch, Palette, Video, Megaphone, HelpCircle, Mail, LifeBuoy,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof BarChart2;
  permission: AdminPermission | AdminPermission[];
};

export type AdminNavSection = {
  label: string;
  collapsible?: boolean;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2, permission: "view_analytics" },
    ],
  },
  {
    label: "User Management",
    collapsible: true,
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "manage_customers" },
      { href: "/admin/roles", label: "Roles", icon: Shield, permission: "manage_roles" },
    ],
  },
  {
    label: "Services",
    collapsible: true,
    items: [
      { href: "/admin/content/build-brand-logs", label: "Build Your Brand", icon: ClipboardList, permission: "view_logs" },
      { href: "/admin/content/logs", label: "Audit Listing", icon: FileSearch, permission: "view_logs" },
      { href: "/admin/content/graphics-logs", label: "Graphics Creation", icon: Palette, permission: "view_logs" },
      { href: "/videos", label: "Create Videos", icon: Video, permission: "view_logs" },
      { href: "/ads/campaigns", label: "Manage Ads", icon: Megaphone, permission: "view_logs" },
    ],
  },
  {
    label: "Billing",
    collapsible: true,
    items: [
      { href: "/admin/plans", label: "Plans & Packages", icon: Layers, permission: "manage_plans" },
      { href: "/admin/credit-rules", label: "Credit Rules", icon: Shield, permission: "manage_credit_rules" },
      { href: "/admin/billing/payments", label: "Payments", icon: CreditCard, permission: "manage_payments" },
      { href: "/admin/billing/invoices", label: "Invoices", icon: FileText, permission: "manage_invoices" },
      { href: "/admin/billing/refunds", label: "Refunds", icon: Layers, permission: "manage_refunds" },
    ],
  },
  {
    label: "Reports",
    collapsible: true,
    items: [
      { href: "/admin/reports/revenue", label: "Revenue Reports", icon: BarChart2, permission: "view_reports" },
      { href: "/admin/reports/customers", label: "Customer Reports", icon: Users, permission: "view_reports" },
      { href: "/admin/reports/subscriptions", label: "Subscription Reports", icon: CreditCard, permission: "view_reports" },
    ],
  },
  {
    label: "Marketing",
    collapsible: true,
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "manage_notifications" },
      { href: "/admin/billing/coupons", label: "Coupons", icon: BadgePercent, permission: "manage_coupons" },
    ],
  },
  {
    label: "Website CMS",
    collapsible: true,
    items: [
      { href: "/admin/marketing/homepage", label: "Homepage", icon: Home, permission: "manage_homepage_cms" },
      { href: "/admin/marketing/pages", label: "Pages", icon: Globe, permission: "manage_pages_cms" },
      { href: "/admin/marketing/navigation", label: "Navigation Menu", icon: Navigation, permission: "manage_navigation" },
      { href: "/admin/marketing/blog", label: "Blog", icon: BookOpen, permission: "manage_blog" },
      { href: "/admin/marketing/seo", label: "SEO", icon: TrendingUp, permission: "manage_seo" },
      { href: "/admin/marketing/testimonials", label: "Testimonials", icon: MessageSquare, permission: "manage_testimonials" },
      { href: "/admin/marketing/help-center", label: "Help Center", icon: HelpCircle, permission: ["manage_homepage_cms", "manage_faqs"] },
      { href: "/admin/marketing/faqs", label: "FAQ", icon: HelpCircle, permission: "manage_faqs" },
      { href: "/admin/marketing/media", label: "Media Library", icon: Image, permission: "manage_media" },
    ],
  },
  {
    label: "Help & Support",
    collapsible: true,
    items: [
      { href: "/admin/help/support-tickets", label: "Support Tickets", icon: LifeBuoy, permission: "manage_support" },
      { href: "/admin/marketing/forms?type=contact", label: "Contact Messages", icon: Mail, permission: "manage_support" },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      { href: "/admin/settings/platform", label: "Company Settings", icon: Settings, permission: "manage_settings" },
      { href: "/admin/settings/default-agents", label: "Default Ecommerce Guru Agents", icon: Bot, permission: "manage_settings" },
      { href: "/admin/settings/api", label: "Webhook Settings", icon: KeyRound, permission: "manage_settings" },
      { href: "/admin/settings/email", label: "Email Settings", icon: Mail, permission: "manage_settings" },
      { href: "/admin/settings/payment-gateway", label: "Payment Settings", icon: Wallet, permission: "manage_settings" },
      { href: "/admin/settings/security", label: "Security Settings", icon: Lock, permission: "manage_settings" },
      { href: "/admin/team-activity", label: "Team Activity", icon: Users, permission: "manage_team_activity" },
    ],
  },
];
