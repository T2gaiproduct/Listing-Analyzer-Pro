import { Suspense, useEffect, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ClerkProvider, SignIn, AuthenticateWithRedirectCallback, Show, useClerk, useUser } from "@clerk/react";
import { useWsNotifications } from "@/hooks/use-ws-notifications";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingHead } from "@/components/branding-head";
import { HomepageCmsProvider } from "@/components/homepage-cms-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { useBranding } from "@/hooks/use-branding";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { WorkspacePermissionGate } from "@/components/workspace-permission-gate";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { ApiTokenBridge } from "@/components/api-token-bridge";
import { fetchJson } from "@/lib/api-fetch";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { buildClerkLocalization } from "@/lib/clerk-localization";
import {
  pendingWorkspaceInviteRedirect,
  requiresOnboarding,
  type ProfileSummaryForGate,
} from "@/lib/onboarding-gate";
import { normalizeAdminPath } from "@workspace/admin-permissions";
import {
  Layout,
  AdminLayout,
  LiveChatWidget,
  Landing,
  NotFound,
  SignUpPage,
  Features,
  Pricing,
  Contact,
  Help,
  Enterprise,
  About,
  Blog,
  BlogPost,
  Terms,
  Privacy,
  Tutorials,
  Dashboard,
  RecentProjectsPage,
  ProductsPage,
  MarketplacesPage,
  ProductDetailPage,
  AuditNew,
  AuditDetail,
  CompetitorNew,
  AuditListings,
  AuditWorkflow,
  Billing,
  Team,
  Profile,
  ProjectsPage,
  CreateProject,
  ProjectDetail,
  GeneratingPage,
  ArchivePage,
  NotificationsPage,
  VideosPage,
  AdsPage,
  AdsWorkflowPage,
  SettingsPage,
  WorkspacesPage,
  WorkspaceDetailPage,
  RolesPage,
  WorkspaceMembersPage,
  AcceptInvite,
  AcceptWorkspaceInvite,
  AcceptAdminInvite,
  Onboarding,
  CheckoutSuccess,
  CheckoutCancel,
  CheckoutCardSuccess,
  CheckoutPayPalSuccess,
  AdminDashboard,
  AdminCustomers,
  AdminCustomerDetail,
  AdminAudits,
  AdminPlans,
  AdminCredits,
  AdminCreditRules,
  AdminAnalytics,
  AdminBillingPayments,
  AdminBillingInvoices,
  AdminBillingRefunds,
  AdminBillingCoupons,
  AdminContentGenerated,
  AdminContentImages,
  AdminContentLogs,
  AdminBuildBrandLogs,
  AdminContentDownloads,
  AdminGraphicsLogs,
  AdminRoles,
  AdminAnnouncements,
  AdminNotifications,
  AdminTeamActivity,
  AdminArchivePage,
  AdminSettingsPlatform,
  AdminSettingsAI,
  AdminSettingsAPI,
  AdminSettingsSecurity,
  AdminSettingsPaymentGateway,
  AdminSettingsEmail,
  AdminMarketingHomepage,
  AdminMarketingPages,
  AdminMarketingBlog,
  AdminBlogEdit,
  AdminMarketingSeo,
  AdminMarketingTestimonials,
  AdminMarketingMedia,
  AdminMarketingForms,
  AdminSupportTickets,
  AdminMarketingNavigation,
  AdminFaqs,
  RevenueReport,
  CustomerReport,
  SubscriptionReport,
} from "@/routes/lazy-pages";

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

function ProfileSummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-lg font-semibold text-slate-900">Cannot load your account</p>
        <p className="text-sm text-slate-500">
          We could not verify your profile from the API. The server may be offline or the preview tunnel lost its
          connection to the backend.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
            onClick={() => void onRetry()}
          >
            Try again
          </button>
          <button
            type="button"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrlFromEnv = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function resolveClerkProxyUrl(): string | undefined {
  if (clerkProxyUrlFromEnv?.trim()) return clerkProxyUrlFromEnv.trim();
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".trycloudflare.com")) {
    // Relative proxy URL keeps Clerk JS + FAPI on the tunnel origin (required for sign-up CAPTCHA).
    const proxyPath = `${basePath}/api/__clerk`.replace(/\/+/g, "/");
    return proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`;
  }
  return undefined;
}

const adminUserIdsEnv = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}


function SignInPage() {
  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get("redirect_url");
  const email = params.get("email") ?? undefined;
  const redirectUrl = redirectParam?.startsWith("/")
    ? `${basePath}${redirectParam}`
    : `${basePath}/dashboard`;
  const signUpUrl = redirectParam
    ? `${basePath}/sign-up?redirect_url=${encodeURIComponent(redirectParam)}${email ? `&email=${encodeURIComponent(email)}` : ""}`
    : `${basePath}/sign-up`;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={signUpUrl}
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
        initialValues={email ? { emailAddress: email } : undefined}
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
      fetchJson<ProfileSummaryForGate>(`${basePath}/api/profile/summary`),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    retry: 3,
    refetchOnWindowFocus: false,
  });
}

function HomeRedirect() {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  const { defaultRoute, isLoaded: permLoaded } = useAdminPermissions();
  const {
    data: summary,
    isFetched: summaryFetched,
    isError: summaryError,
    refetch: refetchSummary,
  } = useOnboardingSummary();
  if (!isLoaded) return <Landing />;
  if (!user) return <Landing />;
  if (!adminLoaded || ((envAdmin || isAdmin) && !permLoaded)) return <AuthLoading />;
  if (envAdmin || isAdmin) return <Redirect to={defaultRoute} />;
  if (!summaryFetched) return <AuthLoading />;
  if (summaryError || !summary) {
    return <ProfileSummaryError onRetry={() => void refetchSummary()} />;
  }
  const inviteRedirect = pendingWorkspaceInviteRedirect(summary);
  if (inviteRedirect) return <Redirect to={inviteRedirect} />;
  if (requiresOnboarding(summary)) return <Redirect to="/onboarding" />;
  return <Redirect to="/dashboard" />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const envAdmin = adminUserIdsEnv.includes(user?.id ?? "");
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  const {
    data: summary,
    isFetched: summaryFetched,
    isError: summaryError,
    refetch: refetchSummary,
  } = useOnboardingSummary();
  if (!isLoaded) return <AuthLoading />;
  const isAdminUser = envAdmin || (adminLoaded && isAdmin);
  if (user && !isAdminUser && !adminLoaded) return <AuthLoading />;
  if (user && !isAdminUser && !summaryFetched) return <AuthLoading />;
  if (user && !isAdminUser && (summaryError || !summary)) {
    return <ProfileSummaryError onRetry={() => void refetchSummary()} />;
  }
  const inviteRedirect = summary ? pendingWorkspaceInviteRedirect(summary) : null;
  if (user && !isAdminUser && inviteRedirect) return <Redirect to={inviteRedirect} />;
  if (user && !isAdminUser && summary && requiresOnboarding(summary)) {
    return <Redirect to="/onboarding" />;
  }
  // Customer SaaS routes always use the customer shell (workspace switcher, sidebar).
  // Platform admins reach /admin/* via AdminRoute with AdminLayout.
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ProfilePageRoute() {
  const { isAdmin, isLoaded } = useIsAdmin();
  if (!isLoaded) return <AuthLoading />;
  if (isAdmin) return <Redirect to="/admin/profile" />;
  return (
    <WorkspaceProtectedRoute>
      <Profile />
    </WorkspaceProtectedRoute>
  );
}

function WorkspaceProtectedRoute({
  requireCreate,
  children,
}: {
  requireCreate?: boolean;
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  return (
    <ProtectedRoute>
      <WorkspacePermissionGate path={location} requireCreate={requireCreate}>
        {children}
      </WorkspacePermissionGate>
    </ProtectedRoute>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const { isAdmin, isLoaded: adminLoaded, isError, refetch } = useIsAdmin();
  const { canAccessRoute, isLoaded: permLoaded, defaultRoute } = useAdminPermissions();
  if (!isLoaded || !adminLoaded || !permLoaded) return <AuthLoading />;
  if (!user) {
    const returnTo = encodeURIComponent(location || "/admin/dashboard");
    return <Redirect to={`/sign-in?redirect_url=${returnTo}`} />;
  }
  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-semibold text-slate-900">Cannot reach admin API</p>
          <p className="text-sm text-slate-500">
            The API server may be offline or the preview tunnel lost its connection to the backend.
            If you are using a Cloudflare preview link, restart the dev stack so the tunnel routes through the API proxy.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
              onClick={() => void refetch()}
            >
              Try again
            </button>
            <button
              type="button"
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    const email = user.emailAddresses?.[0]?.emailAddress ?? "your account";
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg font-semibold text-slate-900">No admin access</p>
          <p className="text-sm text-slate-500">
            You&apos;re signed in as <span className="font-medium text-slate-700">{email}</span>, but this account
            doesn&apos;t have an admin role yet. Ask a super admin to assign you in Admin → Roles.
          </p>
          <a href={`${basePath}/dashboard`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
  if (!canAccessRoute(location)) {
    const current = normalizeAdminPath(location);
    const fallback = normalizeAdminPath(defaultRoute);
    if (fallback !== current) {
      return <Redirect to={defaultRoute} />;
    }
    return (
      <ErrorBoundary title="Admin page failed to load">
        <AdminLayout>
          <AdminAccessDenied defaultRoute={defaultRoute} />
        </AdminLayout>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary title="Admin page failed to load">
      <AdminLayout>{children}</AdminLayout>
    </ErrorBoundary>
  );
}

function AdminHomeRedirect() {
  const { user, isLoaded } = useUser();
  const { isAdmin, isLoaded: adminLoaded } = useIsAdmin();
  const { defaultRoute, isLoaded: permLoaded } = useAdminPermissions();
  if (!isLoaded || !adminLoaded || !permLoaded) return <AuthLoading />;
  if (!user) return <Redirect to="/sign-in?redirect_url=%2Fadmin" />;
  if (!isAdmin) return <Redirect to="/dashboard" />;
  return <Redirect to={defaultRoute} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/sso-callback">
        <div className="flex min-h-[100dvh] items-center justify-center">
          <AuthenticateWithRedirectCallback />
        </div>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <AdminHomeRedirect />
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
      <Route path="/admin/announcements">
        <AdminRoute><AdminAnnouncements /></AdminRoute>
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
      <Route path="/admin/profile">
        <AdminRoute><Profile /></AdminRoute>
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
      <Route path="/blog/:slug">
        {params => <BlogPost slug={params.slug} />}
      </Route>
      <Route path="/blog" component={Blog} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/tutorials" component={Tutorials} />

      {/* Accept invite — full-page, works signed in or out */}
      <Route path="/accept-invite">
        <AcceptInvite />
      </Route>
      <Route path="/accept-workspace-invite">
        <AcceptWorkspaceInvite />
      </Route>
      <Route path="/accept-admin-invite">
        <AcceptAdminInvite />
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
      <Route path="/checkout/paypal-success">
        <Show when="signed-in">
          <CheckoutPayPalSuccess />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>

      {/* Protected customer pages */}
      <Route path="/billing">
        <WorkspaceProtectedRoute><Billing /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/team">
        <WorkspaceProtectedRoute><Team /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/roles">
        <ProtectedRoute><RolesPage /></ProtectedRoute>
      </Route>
      <Route path="/workspaces">
        <WorkspaceProtectedRoute><WorkspacesPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/workspaces/:id/members">
        {params => <WorkspaceProtectedRoute><WorkspaceMembersPage /></WorkspaceProtectedRoute>}
      </Route>
      <Route path="/workspaces/:id/roles">
        <Redirect to="/roles" />
      </Route>
      <Route path="/workspaces/:id">
        {params => <WorkspaceProtectedRoute><WorkspaceDetailPage /></WorkspaceProtectedRoute>}
      </Route>
      <Route path="/profile">
        <ProfilePageRoute />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/marketplaces">
        <WorkspaceProtectedRoute><MarketplacesPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/products/:id">
        {params => (
          <WorkspaceProtectedRoute>
            <ProductDetailPage id={parseInt(params.id, 10)} />
          </WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/products">
        <WorkspaceProtectedRoute><ProductsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/recent-projects">
        <WorkspaceProtectedRoute><RecentProjectsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/audit-listings">
        <WorkspaceProtectedRoute><AuditListings /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/videos">
        <WorkspaceProtectedRoute><VideosPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/ads/new">
        <WorkspaceProtectedRoute requireCreate>
          <AdsWorkflowPage />
        </WorkspaceProtectedRoute>
      </Route>
      <Route path="/ads/:id">
        {params => (
          <WorkspaceProtectedRoute requireCreate>
            <AdsWorkflowPage projectId={parseInt(params.id, 10)} />
          </WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/ads">
        <WorkspaceProtectedRoute><AdsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/settings">
        <WorkspaceProtectedRoute><SettingsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/audits/new">
        <WorkspaceProtectedRoute requireCreate><AuditNew /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/audits/workflow">
        <WorkspaceProtectedRoute requireCreate><AuditWorkflow /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/audits/:id">
        {params => (
          <WorkspaceProtectedRoute><AuditDetail id={parseInt(params.id)} /></WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/audits/:id/competitors/new">
        {params => (
          <WorkspaceProtectedRoute requireCreate><CompetitorNew id={parseInt(params.id)} /></WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/projects">
        <WorkspaceProtectedRoute><ProjectsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/projects/create">
        <WorkspaceProtectedRoute requireCreate><CreateProject /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/projects/:id/generating">
        {params => (
          <WorkspaceProtectedRoute><GeneratingPage params={{ id: params.id }} /></WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/projects/:id">
        {params => (
          <WorkspaceProtectedRoute><ProjectDetail params={{ id: params.id }} /></WorkspaceProtectedRoute>
        )}
      </Route>
      <Route path="/archive">
        <WorkspaceProtectedRoute><ArchivePage /></WorkspaceProtectedRoute>
      </Route>
      <Route path="/notifications">
        <WorkspaceProtectedRoute><NotificationsPage /></WorkspaceProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { logoUrl, platformName } = useBranding();
  const clerkProxyUrl = useMemo(() => resolveClerkProxyUrl(), []);

  const appearance = useMemo(
    () => ({
      ...clerkAppearance,
      options: {
        ...clerkAppearance.options,
        logoImageUrl: logoUrl,
      },
    }),
    [logoUrl],
  );

  const localization = useMemo(() => buildClerkLocalization(platformName), [platformName]);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={localization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <ApiTokenBridge />
      <WorkspaceProvider>
      <TooltipProvider>
        <Suspense fallback={<AuthLoading />}>
          <ErrorBoundary title="Application failed to load">
            <Router />
          </ErrorBoundary>
        </Suspense>
        <Toaster />
        <Suspense fallback={null}>
          <LiveChatWidget />
        </Suspense>
        <WsNotificationListener />
      </TooltipProvider>
      </WorkspaceProvider>
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
        <QueryClientProvider client={queryClient}>
          <HomepageCmsProvider>
            <BrandingHead />
            <ClerkProviderWithRoutes />
          </HomepageCmsProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </WouterRouter>
  );
}

export default App;
