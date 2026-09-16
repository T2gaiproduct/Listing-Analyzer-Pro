import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "listingauditor-theme";
const EXPLICIT_KEY = "listingauditor-theme-explicit";

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

/** Default light; dark only when the user picks it in Settings (never OS auto). */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const explicit = localStorage.getItem(EXPLICIT_KEY) === "1";
    if (stored === "dark" || stored === "light") {
      if (explicit) return stored;
      // Older builds followed prefers-color-scheme and saved dark without user intent.
      return "light";
    }
  } catch {
    /* ignore */
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolved, setResolved] = useState<Theme>(theme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem(EXPLICIT_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setResolved(theme);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
