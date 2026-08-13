import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeProviderState {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeProviderState>({
  theme: "light",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
}

function loadStoredTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("listingauditor-theme");
    if (stored === "dark" || stored === "light") return stored;
    // Migrate legacy "system" preference to the current OS appearance once.
    if (stored === "system" || !stored) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch {}
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(loadStoredTheme);
  const [resolved, setResolved] = useState<"dark" | "light">(theme);

  useEffect(() => {
    setResolved(theme);
    applyTheme(theme);
    try {
      localStorage.setItem("listingauditor-theme", theme);
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}
