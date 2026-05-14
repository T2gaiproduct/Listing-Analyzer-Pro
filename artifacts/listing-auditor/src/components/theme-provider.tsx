import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderState {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeProviderState>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getResolved(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("listingauditor-theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  const [resolved, setResolved] = useState<"dark" | "light">(() => getResolved(theme));

  useEffect(() => {
    const r = getResolved(theme);
    setResolved(r);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(r);
    try {
      localStorage.setItem("listingauditor-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const r = mql.matches ? "dark" : "light";
        setResolved(r);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(r);
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}
