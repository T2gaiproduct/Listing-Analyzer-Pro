import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ClerkProvider, SignIn, AuthenticateWithRedirectCallback, Show, useClerk, useUser } from "@clerk/react";
import { useWsNotifications } from "@/hooks/use-ws-notifications";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LiveChatWidget } from "@/components/live-chat";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import Dashboard from "@/pages/dashboard";
import AuditNew from "@/pages/audit-new";
import AuditDetail from "@/pages/audit-detail";
import CompetitorNew from "@/pages/competitor-new";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCustomers from "@/pages/admin/customers";
import AdminCustomerDetail from "@/pages/admin/customer-detail";
import AdminAudits from "@/pages/admin/audits";
import AdminPlans from "@/pages/admin/plans";
import AdminCredits from "@/pages/admin/credits";
import AdminCreditRules from "@/pages/admin/credit-rules";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminBillingPayments from "@/pages/admin/billing/payments";
import AdminBillingInvoices from "@/pages/admin/billing/invoices";
import AdminBillingRefunds from "@/pages/admin/billing/refunds";
import AdminBillingCoupons from "@/pages/admin/billing/coupons";
import AdminContentGenerated from "@/pages/admin/content/generated";
import AdminContentImages from "@/pages/admin/content/images";
import AdminContentLogs from "@/pages/admin/content/logs";
import AdminBuildBrandLogs from "@/pages/admin/content/build-brand-logs";
import AdminContentDownloads from "@/pages/admin/content/downloads";
import AdminGraphicsLogs from "@/pages/admin/content/graphics-logs";
import AdminRoles from "@/pages/admin/roles";
import AdminNotifications from "@/pages/admin/notifications";
import AdminTeamActivity from "@/pages/admin/team-activity";
import AdminSettingsPlatform from "@/pages/admin/settings/platform";
import AdminSettingsAI from "@/pages/admin/settings/ai";
import AdminSettingsAPI from "@/pages/admin/settings/api";
import AdminSettingsSecurity from "@/pages/admin/settings/security";
import AdminSettingsPaymentGateway from "@/pages/admin/settings/payment-gateway";
import AdminSettingsEmail from "@/pages/admin/settings/email";
import AdminMarketingHomepage from "@/pages/admin/marketing/homepage";
import AdminMarketingPages from "@/pages/admin/marketing/pages";
import AdminMarketingBlog from "@/pages/admin/marketing/blog";
import AdminBlogEdit from "@/pages/admin/marketing/blog-edit";
import AdminMarketingSeo from "@/pages/admin/marketing/seo";
import AdminMarketingTestimonials from "@/pages/admin/marketing/testimonials";
import AdminMarketingMedia from "@/pages/admin/marketing/media";
import AdminMarketingForms from "@/pages/admin/marketing/forms";
import AdminSupportTickets from "@/pages/admin/help/support-tickets";
import AdminMarketingNavigation from "@/pages/admin/marketing/navigation";
import AdminFaqs from "@/pages/admin/marketing/faqs";
import RevenueReport from "@/pages/admin/reports/revenue";
import CustomerReport from "@/pages/admin/reports/customer";
import SubscriptionReport from "@/pages/admin/reports/subscription";
import Pricing from "@/pages/pricing";
import Features from "@/pages/features";
import Contact from "@/pages/contact";
import Help from "@/pages/help";
import Enterprise from "@/pages/enterprise";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Tutorials from "@/pages/tutorials";
import Billing from "@/pages/billing";
import Team from "@/pages/team";
import AcceptInvite from "@/pages/accept-invite";
import Onboarding from "@/pages/onboarding";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
import CheckoutCardSuccess from "@/pages/checkout-card-success";
import Profile from "@/pages/profile";
import SignUpPage from "@/pages/sign-up";
import ProjectsPage from "@/pages/projects";
import CreateProject from "@/pages/projects/create";
import ProjectDetail from "@/pages/projects/detail";
import GeneratingPage from "@/pages/projects/generating";
import ArchivePage from "@/pages/archive";
import NotificationsPage from "@/pages/notifications";
import AdminArchivePage from "@/pages/admin/archive";
import AuditListings from "@/pages/audit-listings";
import AuditWorkflow from "@/pages/audit-workflow";
import VideosPage from "@/pages/videos";
import AdsPage from "@/pages/ads";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const AUTH_SCOPED_QUERY_KEYS = [
  ["is-admin"],
  ["user-profile"],
  ["user-profile-summary"],
  ["team-membership"],
  ["team-membership-credits"],
  ["dashboard"],
  ["notifications"],
] as const;

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-label="Loading" />
    </div>
  );
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#ff8000",
    colorForeground: "#0e1929",
    colorMutedForeground: "#657280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f0f5fa",
    colorInputForeground: "#0e1929",
    colorNeutral: "#dce6f0",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-slate-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-bold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "text-slate-700 font-medium",
    formFieldLabel: "text-slate-700 font-medium",
    footerActionLink: "text-orange-500 hover:text-orange-600 font-semibold",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-orange-500",
    formFieldSuccessText: "text-green-600",
    alertText: "text-slate-700",
    logoBox: "mb-1",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton: "border-slate-200 hover:bg-slate-50",
    formButtonPrimary: "bg-orange-500 hover:bg-orange-600 text-white",
    formFieldInput: "border-slate-200 bg-slate-50 text-slate-900",
    footerAction: "bg-slate-50",
    dividerLine: "bg-slate-200",
    alert: "bg-red-50 border-red-200",
    otpCodeFieldInput: "border-slate-300",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}


function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        for (const queryKey of AUTH_SCOPED_QUERY_KEYS) {
          void qc.removeQueries({ queryKey: [...queryKey] });
        }
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function useOnboardingSummary() {
  const { user, isLoaded } = useUser();
  return useQuery({
    queryKey: ["user-profile-summary"],
    queryFn: () =>
      fetch(`${basePath}/api/profile/summary`, { credentials: "include" }).then(
        (r) => r.json() as Promise<{ onboardingCompleted?: boolean }>,
      ),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    retry: 1,
  });
}

function HomeRedirect() {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  const { data: summary } = useOnboardingSummary();
  if (!isLoaded) return <AuthLoading />;
  if (!user) return <Landing />;
  if (envAdmin) return <Redirect to="/admin/dashboard" />;
  if (!adminLoaded) return <AuthLoading />;
  if (isAdmin) return <Redirect to="/admin/dashboard" />;
  if (summary && !summary.onboardingCompleted) return <Redirect to="/onboarding" />;
  return <Redirect to="/dashboard" />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  const { data: summary } = useOnboardingSummary();
  if (!isLoaded) return <AuthLoading />;
  const isAdminUser = envAdmin || (adminLoaded && isAdmin);
  if (user && !isAdminUser && summary && !summary.onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }
  const Shell = isAdminUser ? AdminLayout : Layout;
  return (
    <>
      <Show when="signed-in">
        <Shell>{children}</Shell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

const adminUserIdsEnv = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function useIsAdmin() {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () =>
      fetch(`${basePath}/api/admin/is-admin`, { credentials: "include" })
        .then((r) => r.json() as Promise<{ isAdmin: boolean }>),
    enabled: isLoaded && !!user && !envAdmin,
    staleTime: 60_000,
  });
  const isAdmin = envAdmin || (data?.isAdmin ?? false);
  return { isAdmin, isLoaded: isLoaded && (!user || envAdmin || !isLoading) };
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  if (!isLoaded || !adminLoaded) return <AuthLoading />;
  if (!user) return <Redirect to="/" />;
  if (!isAdmin) return <Redirect to="/dashboard" />;
  return <AdminLayout>{children}</AdminLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/sso-callback">
        <div className="flex min-h-[100dvh] items-center justify-center">
          <AuthenticateWithRedirectCallback />
        </div>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>
      <Route path="/admin/dashboard">
        <AdminRoute><AdminDashboard /></AdminRoute>
      </Route>
      <Route path="/admin/customers">
        <AdminRoute><AdminCustomers /></AdminRoute>
      </Route>
      <Route path="/admin/customers/:userId">
        {params => <AdminRoute><AdminCustomerDetail userId={params.userId} /></AdminRoute>}
      </Route>
      <Route path="/admin/audits">
        <AdminRoute><AdminAudits /></AdminRoute>
      </Route>
      <Route path="/admin/plans">
        <AdminRoute><AdminPlans /></AdminRoute>
      </Route>
      <Route path="/admin/credits">
        <AdminRoute><AdminCredits /></AdminRoute>
      </Route>
      <Route path="/admin/credit-rules">
        <AdminRoute><AdminCreditRules /></AdminRoute>
      </Route>
      <Route path="/admin/analytics">
        <AdminRoute><AdminAnalytics /></AdminRoute>
      </Route>
      <Route path="/admin/billing/payments">
        <AdminRoute><AdminBillingPayments /></AdminRoute>
      </Route>
      <Route path="/admin/billing/invoices">
        <AdminRoute><AdminBillingInvoices /></AdminRoute>
      </Route>
      <Route path="/admin/billing/refunds">
        <AdminRoute><AdminBillingRefunds /></AdminRoute>
      </Route>
      <Route path="/admin/billing/coupons">
        <AdminRoute><AdminBillingCoupons /></AdminRoute>
      </Route>
      <Route path="/admin/content/generated">
        <AdminRoute><AdminContentGenerated /></AdminRoute>
      </Route>
      <Route path="/admin/content/images">
        <AdminRoute><AdminContentImages /></AdminRoute>
      </Route>
      <Route path="/admin/content/logs">
        <AdminRoute><AdminContentLogs /></AdminRoute>
      </Route>
      <Route path="/admin/content/downloads">
        <AdminRoute><AdminContentDownloads /></AdminRoute>
      </Route>
      <Route path="/admin/content/graphics-logs">
        <AdminRoute><AdminGraphicsLogs /></AdminRoute>
      </Route>
      <Route path="/admin/content/build-brand-logs">
        <AdminRoute><AdminBuildBrandLogs /></AdminRoute>
      </Route>
      <Route path="/admin/roles">
        <AdminRoute><AdminRoles /></AdminRoute>
      </Route>
      <Route path="/admin/notifications">
        <AdminRoute><AdminNotifications /></AdminRoute>
      </Route>
      <Route path="/admin/archive">
        <AdminRoute><AdminArchivePage /></AdminRoute>
      </Route>
      <Route path="/admin/team-activity">
        <AdminRoute><AdminTeamActivity /></AdminRoute>
      </Route>
      <Route path="/admin/settings/platform">
        <AdminRoute><AdminSettingsPlatform /></AdminRoute>
      </Route>
      <Route path="/admin/settings/ai">
        <AdminRoute><AdminSettingsAI /></AdminRoute>
      </Route>
      <Route path="/admin/settings/api">
        <AdminRoute><AdminSettingsAPI /></AdminRoute>
      </Route>
      <Route path="/admin/settings/security">
        <AdminRoute><AdminSettingsSecurity /></AdminRoute>
      </Route>
      <Route path="/admin/settings/payment-gateway">
        <AdminRoute><AdminSettingsPaymentGateway /></AdminRoute>
      </Route>
      <Route path="/admin/settings/email">
        <AdminRoute><AdminSettingsEmail /></AdminRoute>
      </Route>

      {/* Marketing */}
      <Route path="/admin/marketing/homepage">
        <AdminRoute><AdminMarketingHomepage /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/pages">
        <AdminRoute><AdminMarketingPages /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/blog/new">
        <AdminRoute><AdminBlogEdit postId="new" /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/blog/:id">
        {params => <AdminRoute><AdminBlogEdit postId={params.id} /></AdminRoute>}
      </Route>
      <Route path="/admin/marketing/blog">
        <AdminRoute><AdminMarketingBlog /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/seo">
        <AdminRoute><AdminMarketingSeo /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/testimonials">
        <AdminRoute><AdminMarketingTestimonials /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/media">
        <AdminRoute><AdminMarketingMedia /></AdminRoute>
      </Route>
      <Route path="/admin/help/support-tickets">
        <AdminRoute><AdminSupportTickets /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/forms">
        <AdminRoute><AdminMarketingForms /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/navigation">
        <AdminRoute><AdminMarketingNavigation /></AdminRoute>
      </Route>
      <Route path="/admin/marketing/faqs">
        <AdminRoute><AdminFaqs /></AdminRoute>
      </Route>
      <Route path="/admin/reports/revenue">
        <AdminRoute><RevenueReport /></AdminRoute>
      </Route>
      <Route path="/admin/reports/customers">
        <AdminRoute><CustomerReport /></AdminRoute>
      </Route>
      <Route path="/admin/reports/subscriptions">
        <AdminRoute><SubscriptionReport /></AdminRoute>
      </Route>

      {/* Public pages */}
      <Route path="/features" component={Features} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/contact" component={Contact} />
      <Route path="/help" component={Help} />
      <Route path="/enterprise" component={Enterprise} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/tutorials" component={Tutorials} />

      {/* Accept invite — full-page, works signed in or out */}
      <Route path="/accept-invite">
        <AcceptInvite />
      </Route>

      {/* Onboarding — full-page, no Layout wrapper */}
      <Route path="/onboarding">
        <Show when="signed-in">
          <Onboarding />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-up" />
        </Show>
      </Route>

      {/* Stripe checkout result pages — full-page, no Layout wrapper */}
      <Route path="/checkout/success">
        <Show when="signed-in">
          <CheckoutSuccess />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
      <Route path="/checkout/cancel">
        <Show when="signed-in">
          <CheckoutCancel />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
      <Route path="/checkout/card-success">
        <Show when="signed-in">
          <CheckoutCardSuccess />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>

      {/* Protected customer pages */}
      <Route path="/billing">
        <ProtectedRoute><Billing /></ProtectedRoute>
      </Route>
      <Route path="/team">
        <ProtectedRoute><Team /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Profile /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/audit-listings">
        <ProtectedRoute><AuditListings /></ProtectedRoute>
      </Route>
      <Route path="/videos">
        <ProtectedRoute><VideosPage /></ProtectedRoute>
      </Route>
      <Route path="/ads">
        <ProtectedRoute><AdsPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/audits/new">
        <ProtectedRoute><AuditNew /></ProtectedRoute>
      </Route>
      <Route path="/audits/workflow">
        <ProtectedRoute><AuditWorkflow /></ProtectedRoute>
      </Route>
      <Route path="/audits/:id">
        {params => (
          <ProtectedRoute><AuditDetail id={parseInt(params.id)} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/audits/:id/competitors/new">
        {params => (
          <ProtectedRoute><CompetitorNew id={parseInt(params.id)} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/projects">
        <ProtectedRoute><ProjectsPage /></ProtectedRoute>
      </Route>
      <Route path="/projects/create">
        <ProtectedRoute><CreateProject /></ProtectedRoute>
      </Route>
      <Route path="/projects/:id/generating">
        {params => (
          <ProtectedRoute><GeneratingPage params={{ id: params.id }} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/projects/:id">
        {params => (
          <ProtectedRoute><ProjectDetail params={{ id: params.id }} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/archive">
        <ProtectedRoute><ArchivePage /></ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your ListingAuditor account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start auditing your Amazon listings today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
          <LiveChatWidget />
          <WsNotificationListener />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function WsNotificationListener() {
  useWsNotifications();
  return null;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ThemeProvider>
        <ClerkProviderWithRoutes />
      </ThemeProvider>
    </WouterRouter>
  );
}

export default App;
