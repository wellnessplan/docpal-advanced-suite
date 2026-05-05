import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Palette, Check, RotateCcw, Sun, Moon, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { PRESETS, FONT_OPTIONS, applyTheme, applyFont, hexToPreset, ThemePreset } from "@/lib/theme-presets";

export default function ThemeBrandingTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const { mode, toggleMode } = useTheme();
  const [selected, setSelected] = useState<ThemePreset>(PRESETS[0]);
  const [customHex, setCustomHex] = useState<string>(PRESETS[0].hex);
  const [font, setFont] = useState<string>("instrument");

  const { data: savedTheme } = useQuery({
    queryKey: ["clinic-theme", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings").select("setting_value")
        .eq("clinic_id", clinicId).eq("setting_key", "theme_preset").maybeSingle();
      return data?.setting_value || null;
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (!savedTheme) return;
    try {
      const parsed = JSON.parse(savedTheme);
      if (parsed?.primary) {
        setSelected(parsed);
        setCustomHex(parsed.hex || customHex);
        if (parsed.font) setFont(parsed.font);
      }
    } catch {}
  }, [savedTheme]);

  const persist = (preset: ThemePreset) => {
    applyTheme(preset);
    try { localStorage.setItem("db_theme_preset", JSON.stringify(preset)); } catch {}
    if (preset.font) try { localStorage.setItem("db_theme_font", preset.font); } catch {}
  };

  const saveMutation = useMutation({
    mutationFn: async (preset: ThemePreset) => {
      const value = JSON.stringify(preset);
      const { data: existing } = await supabase
        .from("clinic_settings").select("id")
        .eq("clinic_id", clinicId).eq("setting_key", "theme_preset").maybeSingle();
      if (existing) {
        const { error } = await (supabase.from("clinic_settings") as any)
          .update({ setting_value: value, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings").insert({
          clinic_id: clinicId, setting_key: "theme_preset", setting_value: value,
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
    const p = { ...preset, font };
    setSelected(p);
    setCustomHex(preset.hex);
    persist(p);
  };

  const handleFontChange = (key: string) => {
    setFont(key);
    applyFont(key);
    const p = { ...selected, font: key };
    setSelected(p);
    persist(p);
  };

  const handleSave = () => saveMutation.mutate({ ...selected, font });

  const handleReset = () => {
    const p = { ...PRESETS[0], font: "instrument" };
    setSelected(p); setCustomHex(p.hex); setFont("instrument");
    persist(p);
    saveMutation.mutate(p);
  };

  const handleCustomApply = () => {
    const preset = hexToPreset(customHex, font);
    if (!preset) return toast.error("Invalid hex color");
    setSelected(preset);
    persist(preset);
    saveMutation.mutate(preset);
  };

  return (
    <div className="space-y-6">
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

      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Palette className="h-5 w-5 text-primary" /> Brand Theme
          </CardTitle>
          <CardDescription>Pick a preset or fully customize colors and typography</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-3 block">Preset Themes</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESETS.map((preset) => {
                const isSel = selected.name === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelect(preset)}
                    className={cn(
                      "relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md overflow-hidden",
                      isSel ? "border-foreground shadow-elevated" : "border-border hover:border-muted-foreground/40"
                    )}
                  >
                    {isSel && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center z-10">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex h-16 rounded-lg overflow-hidden mb-2 ring-1 ring-border">
                      <div className="w-1/3" style={{ background: `hsl(${preset.sidebarBg})` }} />
                      <div className="flex-1 flex items-center justify-center" style={{ background: preset.hex }}>
                        <div className="h-6 w-6 rounded-full bg-white/90" />
                      </div>
                    </div>
                    <span className="text-xs font-medium block text-center">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <Type className="h-4 w-4" /> Typography
            </Label>
            <Select value={font} onValueChange={handleFontChange}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map(f => (
                  <SelectItem key={f.key} value={f.key}>
                    <span style={{ fontFamily: f.stack }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Custom Brand Color</Label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hex Code</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color" value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                  />
                  <Input
                    value={customHex} onChange={(e) => setCustomHex(e.target.value)}
                    placeholder="#FF5733" className="w-32 font-mono text-sm"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleCustomApply}>Apply Custom Color</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The sidebar will automatically tint to match your brand.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Theme"}
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
            </Button>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Live Preview</Label>
            <div className="rounded-lg overflow-hidden border flex">
              <div className="w-32 p-3 space-y-2" style={{ background: "hsl(var(--sidebar-background))", color: "hsl(var(--sidebar-foreground))" }}>
                <div className="text-xs font-semibold opacity-70">SIDEBAR</div>
                <div className="rounded-md px-2 py-1.5 text-xs" style={{ background: "hsl(var(--sidebar-primary))", color: "hsl(var(--sidebar-primary-foreground))" }}>Active</div>
                <div className="rounded-md px-2 py-1.5 text-xs opacity-80">Item</div>
                <div className="rounded-md px-2 py-1.5 text-xs opacity-80">Item</div>
              </div>
              <div className="flex-1 p-3 bg-background flex flex-wrap gap-2 items-start">
                <div className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground text-xs font-medium">Primary</div>
                <div className="rounded-lg bg-accent px-3 py-1.5 text-accent-foreground text-xs font-medium">Accent</div>
                <div className="rounded-lg border-2 border-primary px-3 py-1.5 text-primary text-xs font-medium">Outline</div>
                <div className="w-full text-sm mt-2" style={{ fontFamily: FONT_OPTIONS.find(f => f.key === font)?.stack }}>
                  The quick brown fox — sample text in your selected font.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
