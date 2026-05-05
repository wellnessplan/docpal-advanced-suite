// Shared theme preset definitions + applier used by Settings tab and ThemeLoader.
export interface ThemePreset {
  name: string;
  primary: string;        // "H S% L%"
  accent: string;
  ring: string;
  sidebarPrimary: string;
  sidebarBg: string;      // saturated tinted dark for visible brand color
  sidebarFg: string;
  hex: string;
  font?: string;          // font family key, see FONT_OPTIONS
}

export const FONT_OPTIONS: { key: string; label: string; stack: string; googleHref?: string }[] = [
  {
    key: "instrument",
    label: "Instrument Sans (Default)",
    stack: "'Instrument Sans', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
  },
  {
    key: "inter",
    label: "Inter",
    stack: "'Inter', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  {
    key: "manrope",
    label: "Manrope",
    stack: "'Manrope', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap",
  },
  {
    key: "plex",
    label: "IBM Plex Sans",
    stack: "'IBM Plex Sans', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
  {
    key: "dmsans",
    label: "DM Sans",
    stack: "'DM Sans', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
  },
  {
    key: "spacegrotesk",
    label: "Space Grotesk",
    stack: "'Space Grotesk', system-ui, sans-serif",
    googleHref: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  },
];

// 4 strong preset themes; sidebars use saturated dark tint of brand color.
export const PRESETS: ThemePreset[] = [
  {
    name: "Sky Blue",
    primary: "197 71% 53%", accent: "197 71% 93%", ring: "197 71% 53%",
    sidebarPrimary: "197 90% 70%", sidebarBg: "205 55% 16%", sidebarFg: "197 35% 92%",
    hex: "#3FA8DC",
  },
  {
    name: "Ruby Red",
    primary: "0 75% 50%", accent: "0 72% 93%", ring: "0 75% 50%",
    sidebarPrimary: "0 85% 65%", sidebarBg: "0 50% 16%", sidebarFg: "0 20% 94%",
    hex: "#D62828",
  },
  {
    name: "Emerald Green",
    primary: "152 65% 38%", accent: "152 60% 92%", ring: "152 65% 38%",
    sidebarPrimary: "152 70% 55%", sidebarBg: "155 45% 14%", sidebarFg: "152 25% 92%",
    hex: "#1F9A5F",
  },
  {
    name: "Royal Purple",
    primary: "262 65% 52%", accent: "262 60% 93%", ring: "262 65% 52%",
    sidebarPrimary: "262 80% 70%", sidebarBg: "262 45% 18%", sidebarFg: "262 25% 94%",
    hex: "#6E3FD4",
  },
];

const lOf = (hsl: string) => parseInt(hsl.trim().split(/\s+/)[2]);
const repL = (hsl: string, l: number) => {
  const [h, s] = hsl.trim().split(/\s+/);
  return `${h} ${s} ${Math.max(0, Math.min(100, l))}%`;
};

export function applyTheme(p: ThemePreset) {
  const root = document.documentElement;
  root.style.setProperty("--primary", p.primary);
  root.style.setProperty("--accent", p.accent);
  root.style.setProperty("--ring", p.ring);
  root.style.setProperty("--accent-foreground", repL(p.primary, Math.max(lOf(p.primary) - 31, 20)));
  root.style.setProperty("--sidebar-primary", p.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-background", p.sidebarBg);
  root.style.setProperty("--sidebar-foreground", p.sidebarFg);
  root.style.setProperty("--sidebar-accent", repL(p.sidebarBg, lOf(p.sidebarBg) + 8));
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-border", repL(p.sidebarBg, lOf(p.sidebarBg) + 6));
  root.style.setProperty("--sidebar-ring", p.sidebarPrimary);
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, hsl(${p.primary}), hsl(${repL(p.primary, Math.min(lOf(p.primary) + 10, 90))}))`
  );
  if (p.font) applyFont(p.font);
}

export function applyFont(key: string) {
  const opt = FONT_OPTIONS.find(f => f.key === key) || FONT_OPTIONS[0];
  // Inject Google Fonts link once per font.
  if (opt.googleHref) {
    const id = `font-${opt.key}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id; link.rel = "stylesheet"; link.href = opt.googleHref;
      document.head.appendChild(link);
    }
  }
  document.documentElement.style.setProperty("--font-heading", opt.stack);
  document.documentElement.style.setProperty("--font-body", opt.stack);
}

export function hexToPreset(hex: string, font?: string): ThemePreset | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100);
  const primary = `${H} ${S}% ${L}%`;
  return {
    name: "Custom",
    primary,
    accent: `${H} ${Math.min(S, 70)}% 93%`,
    ring: primary,
    sidebarPrimary: `${H} ${Math.min(S + 10, 95)}% ${Math.min(L + 15, 75)}%`,
    sidebarBg: `${H} ${Math.max(40, Math.min(S, 55))}% 16%`,
    sidebarFg: `${H} 20% 92%`,
    hex,
    font,
  };
}
