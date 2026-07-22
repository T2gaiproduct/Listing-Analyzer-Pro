import { createContext, useContext } from "react";

type SidebarProjectsContextValue = {
  focusRecentProjects: () => void;
};

const SidebarProjectsContext = createContext<SidebarProjectsContextValue | null>(null);

const fallbackSidebarProjects: SidebarProjectsContextValue = {
  focusRecentProjects: () => {},
};

export function useSidebarProjects() {
  const ctx = useContext(SidebarProjectsContext);
  return ctx ?? fallbackSidebarProjects;
}

export { SidebarProjectsContext };
