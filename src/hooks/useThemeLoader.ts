import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyTheme, applyFont, PRESETS } from "@/lib/theme-presets";

export function useThemeLoader() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;

  useEffect(() => {
    // Apply local cached preset immediately so brand color shows before fetch.
    try {
      const cached = localStorage.getItem("db_theme_preset");
      if (cached) applyTheme(JSON.parse(cached));
      const cachedFont = localStorage.getItem("db_theme_font");
      if (cachedFont) applyFont(cachedFont);
    } catch {}
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("clinic_settings")
      .select("setting_value")
      .eq("clinic_id", clinicId)
      .eq("setting_key", "theme_preset")
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.setting_value) return;
        try {
          const parsed = JSON.parse(data.setting_value);
          if (parsed?.primary) {
            applyTheme(parsed);
            localStorage.setItem("db_theme_preset", JSON.stringify(parsed));
            if (parsed.font) localStorage.setItem("db_theme_font", parsed.font);
          } else {
            const found = PRESETS.find(p => p.name === data.setting_value);
            if (found) applyTheme(found);
          }
        } catch {}
      });
  }, [clinicId]);
}
