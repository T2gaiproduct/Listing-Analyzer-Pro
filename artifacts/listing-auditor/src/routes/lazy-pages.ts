import { lazy } from "react";

export const Layout = lazy(() =>
  import("@/components/layout").then((m) => ({ default: m.Layout })),
);

export const AdminLayout = lazy(() =>
  import("@/components/admin-layout").then((m) => ({ default: m.AdminLayout })),
);

export const LiveChatWidget = lazy(() =>
  import("@/components/live-chat").then((m) => ({ default: m.LiveChatWidget })),
);

export const Landing = lazy(() => import("@/pages/landing"));
export const NotFound = lazy(() => import("@/pages/not-found"));
export const SignUpPage = lazy(() => import("@/pages/sign-up"));

export const Features = lazy(() => import("@/pages/features"));
export const Pricing = lazy(() => import("@/pages/pricing"));
export const Contact = lazy(() => import("@/pages/contact"));
export const Help = lazy(() => import("@/pages/help"));
export const Enterprise = lazy(() => import("@/pages/enterprise"));
export const About = lazy(() => import("@/pages/about"));
export const Blog = lazy(() => import("@/pages/blog"));
export const BlogPost = lazy(() => import("@/pages/blog-post"));
export const Terms = lazy(() => import("@/pages/terms"));
export const Privacy = lazy(() => import("@/pages/privacy"));
export const Tutorials = lazy(() => import("@/pages/tutorials"));

export const Dashboard = lazy(() => import("@/pages/dashboard"));
export const AuditNew = lazy(() => import("@/pages/audit-new"));
export const AuditDetail = lazy(() => import("@/pages/audit-detail"));
export const CompetitorNew = lazy(() => import("@/pages/competitor-new"));
export const AuditListings = lazy(() => import("@/pages/audit-listings"));
export const AuditWorkflow = lazy(() => import("@/pages/audit-workflow"));
export const Billing = lazy(() => import("@/pages/billing"));
export const Team = lazy(() => import("@/pages/team"));
export const Profile = lazy(() => import("@/pages/profile"));
export const ProjectsPage = lazy(() => import("@/pages/projects"));
export const CreateProject = lazy(() => import("@/pages/projects/create"));
export const ProjectDetail = lazy(() => import("@/pages/projects/detail"));
export const GeneratingPage = lazy(() => import("@/pages/projects/generating"));
export const ArchivePage = lazy(() => import("@/pages/archive"));
export const NotificationsPage = lazy(() => import("@/pages/notifications"));
export const VideosPage = lazy(() => import("@/pages/videos"));
export const AdsPage = lazy(() => import("@/pages/ads"));
export const SettingsPage = lazy(() => import("@/pages/settings"));

export const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
export const Onboarding = lazy(() => import("@/pages/onboarding"));
export const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
export const CheckoutCancel = lazy(() => import("@/pages/checkout-cancel"));
export const CheckoutCardSuccess = lazy(() => import("@/pages/checkout-card-success"));

export const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
export const AdminCustomers = lazy(() => import("@/pages/admin/customers"));
export const AdminCustomerDetail = lazy(() => import("@/pages/admin/customer-detail"));
export const AdminAudits = lazy(() => import("@/pages/admin/audits"));
export const AdminPlans = lazy(() => import("@/pages/admin/plans"));
export const AdminCredits = lazy(() => import("@/pages/admin/credits"));
export const AdminCreditRules = lazy(() => import("@/pages/admin/credit-rules"));
export const AdminAnalytics = lazy(() => import("@/pages/admin/analytics"));
export const AdminBillingPayments = lazy(() => import("@/pages/admin/billing/payments"));
export const AdminBillingInvoices = lazy(() => import("@/pages/admin/billing/invoices"));
export const AdminBillingRefunds = lazy(() => import("@/pages/admin/billing/refunds"));
export const AdminBillingCoupons = lazy(() => import("@/pages/admin/billing/coupons"));
export const AdminContentGenerated = lazy(() => import("@/pages/admin/content/generated"));
export const AdminContentImages = lazy(() => import("@/pages/admin/content/images"));
export const AdminContentLogs = lazy(() => import("@/pages/admin/content/logs"));
export const AdminBuildBrandLogs = lazy(() => import("@/pages/admin/content/build-brand-logs"));
export const AdminContentDownloads = lazy(() => import("@/pages/admin/content/downloads"));
export const AdminGraphicsLogs = lazy(() => import("@/pages/admin/content/graphics-logs"));
export const AdminRoles = lazy(() => import("@/pages/admin/roles"));
export const AdminNotifications = lazy(() => import("@/pages/admin/notifications"));
export const AdminTeamActivity = lazy(() => import("@/pages/admin/team-activity"));
export const AdminArchivePage = lazy(() => import("@/pages/admin/archive"));
export const AdminSettingsPlatform = lazy(() => import("@/pages/admin/settings/platform"));
export const AdminSettingsAI = lazy(() => import("@/pages/admin/settings/ai"));
export const AdminSettingsAPI = lazy(() => import("@/pages/admin/settings/api"));
export const AdminSettingsSecurity = lazy(() => import("@/pages/admin/settings/security"));
export const AdminSettingsPaymentGateway = lazy(() => import("@/pages/admin/settings/payment-gateway"));
export const AdminSettingsEmail = lazy(() => import("@/pages/admin/settings/email"));
export const AdminMarketingHomepage = lazy(() => import("@/pages/admin/marketing/homepage"));
export const AdminMarketingPages = lazy(() => import("@/pages/admin/marketing/pages"));
export const AdminMarketingBlog = lazy(() => import("@/pages/admin/marketing/blog"));
export const AdminBlogEdit = lazy(() => import("@/pages/admin/marketing/blog-edit"));
export const AdminMarketingSeo = lazy(() => import("@/pages/admin/marketing/seo"));
export const AdminMarketingTestimonials = lazy(() => import("@/pages/admin/marketing/testimonials"));
export const AdminMarketingMedia = lazy(() => import("@/pages/admin/marketing/media"));
export const AdminMarketingForms = lazy(() => import("@/pages/admin/marketing/forms"));
export const AdminSupportTickets = lazy(() => import("@/pages/admin/help/support-tickets"));
export const AdminMarketingNavigation = lazy(() => import("@/pages/admin/marketing/navigation"));
export const AdminFaqs = lazy(() => import("@/pages/admin/marketing/faqs"));
export const RevenueReport = lazy(() => import("@/pages/admin/reports/revenue"));
export const CustomerReport = lazy(() => import("@/pages/admin/reports/customer"));
export const SubscriptionReport = lazy(() => import("@/pages/admin/reports/subscription"));
