import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import AuditNew from "@/pages/audit-new";
import AuditDetail from "@/pages/audit-detail";
import CompetitorNew from "@/pages/competitor-new";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/audits/new">
        <Layout><AuditNew /></Layout>
      </Route>
      <Route path="/audits/:id">
        {params => <Layout><AuditDetail id={parseInt(params.id)} /></Layout>}
      </Route>
      <Route path="/audits/:id/competitors/new">
        {params => <Layout><CompetitorNew id={parseInt(params.id)} /></Layout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
