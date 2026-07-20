import { createContext, useContext, type ReactNode } from "react";
import { mergeHomepageCms, type HomepageCmsMap } from "@/lib/homepage-cms";
import { useHomepageCms } from "@/hooks/use-homepage-cms";

const HomepageCmsContext = createContext<HomepageCmsMap>(mergeHomepageCms({}));

export function HomepageCmsProvider({ children }: { children: ReactNode }) {
  const { cms } = useHomepageCms();
  return (
    <HomepageCmsContext.Provider value={cms}>
      {children}
    </HomepageCmsContext.Provider>
  );
}

export function useHomepageCmsContext() {
  return useContext(HomepageCmsContext);
}
