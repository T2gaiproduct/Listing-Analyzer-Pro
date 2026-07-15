import { createContext, useContext } from "react";

type SidebarProjectsContextValue = {
  focusRecentProjects: () => void;
};

const SidebarProjectsContext = createContext<SidebarProjectsContextValue | null>(null);

export function useSidebarProjects() {
  const ctx = useContext(SidebarProjectsContext);
  if (!ctx) {
    throw new Error("useSidebarProjects must be used within Layout");
  }
  return ctx;
}

export { SidebarProjectsContext };
