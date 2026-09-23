import { lazyWithRetry } from "@/lib/lazy-with-retry";

export const Layout = lazyWithRetry(() =>
  import("@/components/layout").then((m) => ({ default: m.Layout })),
);

export const AdminLayout = lazyWithRetry(() =>
  import("@/components/admin-layout").then((m) => ({ default: m.AdminLayout })),
);

export const LiveChatWidget = lazyWithRetry(() =>
  import("@/components/live-chat").then((m) => ({ default: m.LiveChatWidget })),
);

export const Landing = lazyWithRetry(() => import("@/pages/landing"));
export const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
export const SignUpPage = lazyWithRetry(() => import("@/pages/sign-up"));

export const Features = lazyWithRetry(() => import("@/pages/features"));
export const Pricing = lazyWithRetry(() => import("@/pages/pricing"));
export const Contact = lazyWithRetry(() => import("@/pages/contact"));
export const Help = lazyWithRetry(() => import("@/pages/help"));
export const Enterprise = lazyWithRetry(() => import("@/pages/enterprise"));
export const About = lazyWithRetry(() => import("@/pages/about"));
export const Blog = lazyWithRetry(() => import("@/pages/blog"));
export const BlogPost = lazyWithRetry(() => import("@/pages/blog-post"));
export const Terms = lazyWithRetry(() => import("@/pages/terms"));
export const Privacy = lazyWithRetry(() => import("@/pages/privacy"));
export const Tutorials = lazyWithRetry(() => import("@/pages/tutorials"));
export const PublicListingPreviewPage = lazyWithRetry(() => import("@/pages/public-listing-preview"));

export const Dashboard = lazyWithRetry(() => import("@/pages/dashboard"));
export const ProductsPage = lazyWithRetry(() => import("@/pages/products"));
export const MarketplacesPage = lazyWithRetry(() => import("@/pages/marketplaces"));
export const ProductDetailPage = lazyWithRetry(() => import("@/pages/product-detail"));
export const RecentProjectsPage = lazyWithRetry(() => import("@/pages/recent-projects"));
export const AuditNew = lazyWithRetry(() => import("@/pages/audit-new"));
export const AuditDetail = lazyWithRetry(() => import("@/pages/audit-detail"));
export const CompetitorNew = lazyWithRetry(() => import("@/pages/competitor-new"));
export const AuditListings = lazyWithRetry(() => import("@/pages/audit-listings"));
export const AuditWorkflow = lazyWithRetry(() => import("@/pages/audit-workflow"));
export const Billing = lazyWithRetry(() => import("@/pages/billing"));
export const Team = lazyWithRetry(() => import("@/pages/team"));
export const Profile = lazyWithRetry(() => import("@/pages/profile"));
export const ProjectsPage = lazyWithRetry(() => import("@/pages/projects"));
export const CreateProject = lazyWithRetry(() => import("@/pages/projects/create"));
export const ProjectDetail = lazyWithRetry(() => import("@/pages/projects/detail"));
export const GeneratingPage = lazyWithRetry(() => import("@/pages/projects/generating"));
export const ArchivePage = lazyWithRetry(() => import("@/pages/archive"));
export const NotificationsPage = lazyWithRetry(() => import("@/pages/notifications"));
export const VideosPage = lazyWithRetry(() => import("@/pages/videos"));
export const AdsPage = lazyWithRetry(() => import("@/pages/ads"));
export const SellerMateAiPage = lazyWithRetry(() => import("@/pages/sellermate-ai"));
export const AdsCampaignsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-campaigns"));
export const AdsCampaignManagerPage = lazyWithRetry(() => import("@/pages/ads-console-manager"));
export const AdsTargetsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-targets"));
export const AdsSearchTermsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-search-terms"));
export const AdsProductsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-products"));
export const AdsPlacementsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-placements"));
export const AdsNegativeTargetsConsolePage = lazyWithRetry(() => import("@/pages/ads-console-negative-targets"));
export const AdsWorkflowPage = lazyWithRetry(() => import("@/pages/ads-workflow"));
export const SettingsPage = lazyWithRetry(() => import("@/pages/settings"));
export const SupportTicketPage = lazyWithRetry(() => import("@/pages/support-ticket"));
export const WorkspacesPage = lazyWithRetry(() => import("@/pages/workspaces"));
export const WorkspaceDetailPage = lazyWithRetry(() => import("@/pages/workspace-detail"));
export const RolesPage = lazyWithRetry(() => import("@/pages/roles"));
export const WorkspaceMembersPage = lazyWithRetry(() => import("@/pages/workspace-members"));

export const AcceptInvite = lazyWithRetry(() => import("@/pages/accept-invite"));
export const AcceptWorkspaceInvite = lazyWithRetry(() => import("@/pages/accept-workspace-invite"));
export const AcceptAdminInvite = lazyWithRetry(() => import("@/pages/accept-admin-invite"));
export const Onboarding = lazyWithRetry(() => import("@/pages/onboarding"));
export const CheckoutSuccess = lazyWithRetry(() => import("@/pages/checkout-success"));
export const CheckoutCancel = lazyWithRetry(() => import("@/pages/checkout-cancel"));
export const CheckoutCardSuccess = lazyWithRetry(() => import("@/pages/checkout-card-success"));
export const CheckoutPayPalSuccess = lazyWithRetry(() => import("@/pages/checkout-paypal-success"));

export const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/dashboard"));
export const AdminCustomers = lazyWithRetry(() => import("@/pages/admin/customers"));
export const AdminCustomerDetail = lazyWithRetry(() => import("@/pages/admin/customer-detail"));
export const AdminAudits = lazyWithRetry(() => import("@/pages/admin/audits"));
export const AdminPlans = lazyWithRetry(() => import("@/pages/admin/plans"));
export const AdminCredits = lazyWithRetry(() => import("@/pages/admin/credits"));
export const AdminCreditRules = lazyWithRetry(() => import("@/pages/admin/credit-rules"));
export const AdminAnalytics = lazyWithRetry(() => import("@/pages/admin/analytics"));
export const AdminBillingPayments = lazyWithRetry(() => import("@/pages/admin/billing/payments"));
export const AdminBillingInvoices = lazyWithRetry(() => import("@/pages/admin/billing/invoices"));
export const AdminBillingRefunds = lazyWithRetry(() => import("@/pages/admin/billing/refunds"));
export const AdminBillingCoupons = lazyWithRetry(() => import("@/pages/admin/billing/coupons"));
export const AdminContentGenerated = lazyWithRetry(() => import("@/pages/admin/content/generated"));
export const AdminContentImages = lazyWithRetry(() => import("@/pages/admin/content/images"));
export const AdminContentLogs = lazyWithRetry(() => import("@/pages/admin/content/logs"));
export const AdminBuildBrandLogs = lazyWithRetry(() => import("@/pages/admin/content/build-brand-logs"));
export const AdminContentDownloads = lazyWithRetry(() => import("@/pages/admin/content/downloads"));
export const AdminGraphicsLogs = lazyWithRetry(() => import("@/pages/admin/content/graphics-logs"));
export const AdminRoles = lazyWithRetry(() => import("@/pages/admin/roles"));
export const AdminAnnouncements = lazyWithRetry(() => import("@/pages/admin/announcements"));
export const AdminNotifications = lazyWithRetry(() => import("@/pages/admin/notifications"));
export const AdminTeamActivity = lazyWithRetry(() => import("@/pages/admin/team-activity"));
export const AdminArchivePage = lazyWithRetry(() => import("@/pages/admin/archive"));
export const AdminSettingsPlatform = lazyWithRetry(() => import("@/pages/admin/settings/platform"));
export const AdminSettingsAI = lazyWithRetry(() => import("@/pages/admin/settings/ai"));
export const AdminSettingsDefaultAgents = lazyWithRetry(() => import("@/pages/admin/settings/default-agents"));
export const AdminSettingsAPI = lazyWithRetry(() => import("@/pages/admin/settings/api"));
export const AdminSettingsSecurity = lazyWithRetry(() => import("@/pages/admin/settings/security"));
export const AdminSettingsPaymentGateway = lazyWithRetry(() => import("@/pages/admin/settings/payment-gateway"));
export const AdminSettingsEmail = lazyWithRetry(() => import("@/pages/admin/settings/email"));
export const AdminMarketingHomepage = lazyWithRetry(() => import("@/pages/admin/marketing/homepage"));
export const AdminMarketingPages = lazyWithRetry(() => import("@/pages/admin/marketing/pages"));
export const AdminMarketingBlog = lazyWithRetry(() => import("@/pages/admin/marketing/blog"));
export const AdminBlogEdit = lazyWithRetry(() => import("@/pages/admin/marketing/blog-edit"));
export const AdminMarketingSeo = lazyWithRetry(() => import("@/pages/admin/marketing/seo"));
export const AdminMarketingTestimonials = lazyWithRetry(() => import("@/pages/admin/marketing/testimonials"));
export const AdminMarketingMedia = lazyWithRetry(() => import("@/pages/admin/marketing/media"));
export const AdminMarketingForms = lazyWithRetry(() => import("@/pages/admin/marketing/forms"));
export const AdminSupportTickets = lazyWithRetry(() => import("@/pages/admin/help/support-tickets"));
export const AdminMarketingNavigation = lazyWithRetry(() => import("@/pages/admin/marketing/navigation"));
export const AdminFaqs = lazyWithRetry(() => import("@/pages/admin/marketing/faqs"));
export const AdminMarketingHelpCenter = lazyWithRetry(() => import("@/pages/admin/marketing/help-center"));
export const RevenueReport = lazyWithRetry(() => import("@/pages/admin/reports/revenue"));
export const CustomerReport = lazyWithRetry(() => import("@/pages/admin/reports/customer"));
export const SubscriptionReport = lazyWithRetry(() => import("@/pages/admin/reports/subscription"));
