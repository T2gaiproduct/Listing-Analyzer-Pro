import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import AdminAnalytics from "@/pages/admin/analytics";
import Pricing from "@/pages/pricing";
import Features from "@/pages/features";
import Contact from "@/pages/contact";
import Help from "@/pages/help";
import Enterprise from "@/pages/enterprise";
import Billing from "@/pages/billing";
import Team from "@/pages/team";

const queryClient = new QueryClient();

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
        forceRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/dashboard`}
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
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

const adminUserIds = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!user) return <Redirect to="/" />;
  if (!adminUserIds.includes(user.id)) return <Redirect to="/dashboard" />;
  return <AdminLayout>{children}</AdminLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

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
      <Route path="/admin/analytics">
        <AdminRoute><AdminAnalytics /></AdminRoute>
      </Route>

      {/* Public pages */}
      <Route path="/features" component={Features} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/contact" component={Contact} />
      <Route path="/help" component={Help} />
      <Route path="/enterprise" component={Enterprise} />

      {/* Protected customer pages */}
      <Route path="/billing">
        <ProtectedRoute><Billing /></ProtectedRoute>
      </Route>
      <Route path="/team">
        <ProtectedRoute><Team /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/audits/new">
        <ProtectedRoute><AuditNew /></ProtectedRoute>
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
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
