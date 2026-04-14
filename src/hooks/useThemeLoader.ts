import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function applyThemeFromPreset(preset: any) {
  const root = document.documentElement;
  if (!preset?.primary) return;
  root.style.setProperty("--primary", preset.primary);
  root.style.setProperty("--accent", preset.accent);
  root.style.setProperty("--ring", preset.ring);
  root.style.setProperty("--accent-foreground", preset.primary.replace(/\d+%$/, (m: string) => {
    return `${Math.max(parseInt(m) - 31, 20)}%`;
  }));
  root.style.setProperty("--sidebar-primary", preset.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-background", preset.sidebarBg);
  root.style.setProperty("--sidebar-accent", preset.sidebarBg.replace(/\d+%$/, (m: string) => {
    return `${parseInt(m) + 6}%`;
  }));
  root.style.setProperty("--sidebar-ring", preset.sidebarPrimary);
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${preset.primary}), hsl(${preset.primary.replace(/\d+%$/, (m: string) => `${Math.min(parseInt(m) + 10, 90)}%`)}))`);
}

export function useThemeLoader() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("clinic_settings")
      .select("setting_value")
      .eq("clinic_id", clinicId)
      .eq("setting_key", "theme_preset")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.setting_value) {
          try {
            applyThemeFromPreset(JSON.parse(data.setting_value));
          } catch {}
        }
      });
  }, [clinicId]);
}
