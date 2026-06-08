import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Volume2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * MorningBrief — AI-narrated daily summary for the doctor.
 * Calls the `clinic-morning-brief` edge function and supports text-to-speech read-aloud.
 */
export default function MorningBrief() {
  const { profile, clinicId } = useAuth();
  const [brief, setBrief] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = profile?.full_name?.split(" ")[0] || "Doctor";

  const cacheKey = `db_brief_${clinicId}_${new Date().toISOString().slice(0, 10)}`;

  const fetchBrief = async (force = false) => {
    if (!clinicId) return;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setBrief(cached); return; }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinic-morning-brief", {
        body: { clinic_id: clinicId, doctor_name: firstName },
      });
      if (!error && data?.brief) {
        setBrief(data.brief);
        sessionStorage.setItem(cacheKey, data.brief);
      } else {
        setBrief("Welcome back. Let's make today count.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrief(); /* eslint-disable-next-line */ }, [clinicId]);

  const speak = () => {
    if (!brief || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(brief);
    u.rate = 1; u.pitch = 1;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-accent/40 p-4 md:p-5 shadow-card">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg ring-1 ring-white/30">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-base md:text-lg font-bold text-foreground">
              {greeting}, {firstName}
            </h2>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={speak} title="Read aloud" disabled={!brief}>
                <Volume2 className={cn("h-3.5 w-3.5", speaking && "text-primary animate-pulse")} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchBrief(true)} title="Refresh">
                <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-foreground/85 leading-relaxed">
            {loading && !brief ? (
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse [animation-delay:120ms]" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse [animation-delay:240ms]" />
              </span>
            ) : brief}
          </p>
        </div>
      </div>
    </div>
  );
}
