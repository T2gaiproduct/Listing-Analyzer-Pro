import { Redirect } from "wouter";
import { isEcommGuruProductionRestrictedPath } from "@/lib/ecomm-guru-production-nav";

/** Redirects hidden module routes on www.ecomm-guru.com to the dashboard. */
export function EcommGuruProductionNavGate({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && isEcommGuruProductionRestrictedPath(window.location.pathname)) {
    return <Redirect to="/dashboard" />;
  }
  return <>{children}</>;
}