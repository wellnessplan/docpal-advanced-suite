import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

type Mode = "light" | "dark";

interface ThemeContextType {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  customColor: string | null;       // hex e.g. "#5BADE6"
  setCustomColor: (hex: string | null) => void;
}

const STORAGE_MODE = "db_theme_mode";
const STORAGE_COLOR = "db_theme_color";

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  setMode: () => {},
  toggleMode: () => {},
  customColor: null,
  setCustomColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyCustomColor(hex: string | null) {
  const root = document.documentElement;
  if (!hex) {
    // remove overrides
    ["--primary", "--accent", "--ring", "--accent-foreground", "--sidebar-primary", "--sidebar-ring", "--gradient-primary"]
      .forEach(v => root.style.removeProperty(v));
    return;
  }
  const hsl = hexToHSL(hex);
  if (!hsl) return;
  const { h, s, l } = hsl;
  const primary = `${h} ${s}% ${l}%`;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--accent", `${h} ${Math.min(s, 70)}% 93%`);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--accent-foreground", `${h} ${s}% ${Math.max(l - 31, 20)}%`);
  root.style.setProperty("--sidebar-primary", `${h} ${s}% ${Math.min(l + 5, 70)}%`);
  root.style.setProperty("--sidebar-ring", `${h} ${s}% ${Math.min(l + 5, 70)}%`);
  root.style.setProperty("--gradient-primary",
    `linear-gradient(135deg, hsl(${h} ${s}% ${l}%), hsl(${h} ${s}% ${Math.min(l + 10, 90)}%))`);
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(STORAGE_MODE) as Mode) || "light";
  });
  const [customColor, setCustomColorState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_COLOR);
  });

  // Apply on mount + whenever changes
  useEffect(() => {
    applyMode(mode);
    localStorage.setItem(STORAGE_MODE, mode);
  }, [mode]);

  useEffect(() => {
    applyCustomColor(customColor);
    if (customColor) localStorage.setItem(STORAGE_COLOR, customColor);
    else localStorage.removeItem(STORAGE_COLOR);
  }, [customColor]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const toggleMode = useCallback(() => setModeState(m => m === "light" ? "dark" : "light"), []);
  const setCustomColor = useCallback((hex: string | null) => setCustomColorState(hex), []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, customColor, setCustomColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
