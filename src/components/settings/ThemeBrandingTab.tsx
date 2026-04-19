import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Palette, Check, RotateCcw, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemePreset {
  name: string;
  primary: string;       // HSL values only e.g. "197 71% 63%"
  accent: string;
  ring: string;
  sidebarPrimary: string;
  sidebarBg: string;
  hex: string;           // Preview swatch
}

const presets: ThemePreset[] = [
  {
    name: "Sky Blue (Default)",
    primary: "197 71% 63%", accent: "197 71% 93%", ring: "197 71% 63%",
    sidebarPrimary: "197 71% 68%", sidebarBg: "215 28% 10%", hex: "#5BADE6",
  },
  {
    name: "Ruby Red",
    primary: "0 72% 55%", accent: "0 72% 93%", ring: "0 72% 55%",
    sidebarPrimary: "0 72% 60%", sidebarBg: "0 28% 10%", hex: "#D94444",
  },
  {
    name: "Emerald Green",
    primary: "152 60% 42%", accent: "152 60% 92%", ring: "152 60% 42%",
    sidebarPrimary: "152 60% 48%", sidebarBg: "152 28% 10%", hex: "#2BA86A",
  },
  {
    name: "Royal Purple",
    primary: "262 60% 55%", accent: "262 60% 93%", ring: "262 60% 55%",
    sidebarPrimary: "262 60% 60%", sidebarBg: "262 28% 10%", hex: "#7B4FD4",
  },
  {
    name: "Warm Orange",
    primary: "25 90% 52%", accent: "25 90% 93%", ring: "25 90% 52%",
    sidebarPrimary: "25 90% 58%", sidebarBg: "25 28% 10%", hex: "#E87B1A",
  },
  {
    name: "Teal",
    primary: "174 62% 42%", accent: "174 62% 92%", ring: "174 62% 42%",
    sidebarPrimary: "174 62% 48%", sidebarBg: "174 28% 10%", hex: "#28A99E",
  },
  {
    name: "Hot Pink",
    primary: "330 70% 55%", accent: "330 70% 93%", ring: "330 70% 55%",
    sidebarPrimary: "330 70% 60%", sidebarBg: "330 28% 10%", hex: "#D94490",
  },
  {
    name: "Slate Navy",
    primary: "220 60% 45%", accent: "220 60% 92%", ring: "220 60% 45%",
    sidebarPrimary: "220 60% 52%", sidebarBg: "220 28% 8%", hex: "#3860B0",
  },
];

function applyTheme(preset: ThemePreset) {
  const root = document.documentElement;
  root.style.setProperty("--primary", preset.primary);
  root.style.setProperty("--accent", preset.accent);
  root.style.setProperty("--ring", preset.ring);
  root.style.setProperty("--accent-foreground", preset.primary.replace(/\d+%$/, (m) => {
    const val = parseInt(m);
    return `${Math.max(val - 31, 20)}%`;
  }));
  root.style.setProperty("--sidebar-primary", preset.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-background", preset.sidebarBg);
  root.style.setProperty("--sidebar-accent", preset.sidebarBg.replace(/\d+%$/, (m) => {
    const val = parseInt(m);
    return `${val + 6}%`;
  }));
  root.style.setProperty("--sidebar-ring", preset.sidebarPrimary);
  // Update gradient
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${preset.primary}), hsl(${preset.primary.replace(/\d+%$/, (m) => `${Math.min(parseInt(m) + 10, 90)}%`)}))`);
}

export default function ThemeBrandingTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const { mode, toggleMode, customColor, setCustomColor } = useTheme();
  const [selected, setSelected] = useState<string>("Sky Blue (Default)");
  const [customHex, setCustomHex] = useState(customColor || "#5BADE6");

  const { data: savedTheme } = useQuery({
    queryKey: ["clinic-theme", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("setting_value")
        .eq("clinic_id", clinicId)
        .eq("setting_key", "theme_preset")
        .maybeSingle();
      return data?.setting_value || null;
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        if (parsed.name) {
          setSelected(parsed.name);
          applyTheme(parsed);
        }
      } catch {
        // find preset by name
        const found = presets.find(p => p.name === savedTheme);
        if (found) {
          setSelected(found.name);
          applyTheme(found);
        }
      }
    }
  }, [savedTheme]);

  const saveMutation = useMutation({
    mutationFn: async (preset: ThemePreset) => {
      const { data: existing } = await supabase
        .from("clinic_settings")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("setting_key", "theme_preset")
        .maybeSingle();

      const value = JSON.stringify(preset);

      if (existing) {
        const { error } = await (supabase.from("clinic_settings") as any)
          .update({ setting_value: value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings").insert({
          clinic_id: clinicId,
          setting_key: "theme_preset",
          setting_value: value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-theme"] });
      toast.success("Theme saved! All users will see this branding.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSelect = (preset: ThemePreset) => {
    setSelected(preset.name);
    applyTheme(preset);
  };

  const handleSave = () => {
    const preset = presets.find(p => p.name === selected);
    if (preset) saveMutation.mutate(preset);
  };

  const handleReset = () => {
    const defaultPreset = presets[0];
    setSelected(defaultPreset.name);
    applyTheme(defaultPreset);
    saveMutation.mutate(defaultPreset);
  };

  const hexToHSL = (hex: string): ThemePreset | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    const primary = `${h} ${s}% ${l}%`;
    return {
      name: "Custom",
      primary,
      accent: `${h} ${s}% 93%`,
      ring: primary,
      sidebarPrimary: `${h} ${s}% ${Math.min(l + 5, 70)}%`,
      sidebarBg: `${h} 28% 10%`,
      hex,
    };
  };

  const handleCustomApply = () => {
    const preset = hexToHSL(customHex);
    if (preset) {
      setSelected("Custom");
      applyTheme(preset);
      setCustomColor(customHex); // persist locally too
      saveMutation.mutate(preset);
    } else {
      toast.error("Invalid hex color");
    }
  };

  const handleClearCustom = () => {
    setCustomColor(null);
    toast.success("Custom color cleared. Reload to see preset palette.");
  };

  return (
    <div className="space-y-6">
      {/* Display Mode Card */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            {mode === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            Display Mode
          </CardTitle>
          <CardDescription>Switch between light and dark mode (saved on this device)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {mode === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <p className="font-semibold text-sm capitalize">{mode} mode</p>
                <p className="text-xs text-muted-foreground">
                  {mode === "dark" ? "Easy on the eyes for long sessions" : "Bright and clear for daytime use"}
                </p>
              </div>
            </div>
            <Switch checked={mode === "dark"} onCheckedChange={toggleMode} />
          </div>
        </CardContent>
      </Card>

      {/* Brand Theme Card */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Palette className="h-5 w-5 text-primary" /> Brand Theme
          </CardTitle>
          <CardDescription>Choose a color theme that matches your hospital/clinic branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Presets Grid */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Preset Palettes</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSelect(preset)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-md",
                  selected === preset.name
                    ? "border-foreground shadow-elevated bg-muted"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                {selected === preset.name && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div
                  className="h-10 w-10 rounded-full shadow-md ring-2 ring-border"
                  style={{ background: preset.hex }}
                />
                <span className="text-xs font-medium text-center leading-tight">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Color */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-3 block">Custom Brand Color</Label>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hex Code</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                />
                <Input
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  placeholder="#FF5733"
                  className="w-28 font-mono text-sm"
                />
              </div>
            </div>
            <Button size="sm" onClick={handleCustomApply}>Apply Custom</Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t pt-4">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            Save Theme
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
          </Button>
        </div>

        {/* Preview */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-3 block">Live Preview</Label>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-medium">Primary Button</div>
            <div className="rounded-lg bg-accent px-4 py-2 text-accent-foreground text-sm font-medium">Accent Badge</div>
            <div className="rounded-lg bg-sidebar px-4 py-2 text-sidebar-foreground text-sm font-medium">Sidebar</div>
            <div className="rounded-lg border-2 border-primary px-4 py-2 text-primary text-sm font-medium">Outline</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
