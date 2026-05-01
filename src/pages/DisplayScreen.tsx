import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl } from "@/lib/video-utils";
import { Tv } from "lucide-react";
import LowerThird from "@/components/displays/LowerThird";

// Public TV display screen — no auth. Reads by pair_code, listens to realtime updates.
export default function DisplayScreen() {
  const { code } = useParams();
  const [screen, setScreen] = useState<any>(null);
  const [video, setVideo] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [now, setNow] = useState(new Date());
  const tickRef = useRef<any>(null);

  // Initial load + heartbeat
  useEffect(() => {
    if (!code) return;
    let mounted = true;

    const loadAll = async () => {
      const { data: s } = await supabase
        .from("display_screens" as any)
        .select("*")
        .eq("pair_code", code.toUpperCase())
        .maybeSingle();
      if (!s || !mounted) return;
      setScreen(s);
      // Mark paired + heartbeat
      await supabase.from("display_screens" as any).update({
        is_paired: true,
        last_seen_at: new Date().toISOString(),
      }).eq("id", (s as any).id);

      // Branding
      const { data: br } = await supabase
        .from("display_branding" as any)
        .select("*")
        .eq("clinic_id", (s as any).clinic_id)
        .maybeSingle();
      setBranding(br);

      // Initial video
      if ((s as any).current_video_id) {
        const { data: v } = await supabase
          .from("education_videos" as any)
          .select("*")
          .eq("id", (s as any).current_video_id)
          .maybeSingle();
        setVideo(v);
      }

      // Queue (today's checked-in patients waiting)
      loadQueue((s as any).clinic_id);
    };

    const loadQueue = async (clinicId: string) => {
      const { data } = await supabase
        .from("queue_tokens" as any)
        .select("token_number, status, patient_id, patients(full_name)")
        .eq("clinic_id", clinicId)
        .eq("queue_date", new Date().toISOString().split("T")[0])
        .order("token_number", { ascending: true })
        .limit(8);
      setQueue((data as any[]) || []);
    };

    loadAll();

    // Heartbeat every 15s
    const heartbeat = setInterval(async () => {
      const { data: s } = await supabase
        .from("display_screens" as any)
        .select("*")
        .eq("pair_code", code.toUpperCase())
        .maybeSingle();
      if (s) {
        await supabase.from("display_screens" as any)
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", (s as any).id);
        loadQueue((s as any).clinic_id);
      }
    }, 15000);

    return () => { mounted = false; clearInterval(heartbeat); };
  }, [code]);

  // Realtime subscription for screen updates
  useEffect(() => {
    if (!screen) return;
    const channel = supabase
      .channel(`display-${screen.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "display_screens", filter: `id=eq.${screen.id}` },
        async (payload) => {
          const newS: any = payload.new;
          setScreen(newS);
          if (newS.current_video_id && newS.current_video_id !== video?.id) {
            const { data: v } = await supabase.from("education_videos" as any).select("*").eq("id", newS.current_video_id).maybeSingle();
            setVideo(v);
          }
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "display_branding", filter: `clinic_id=eq.${screen.clinic_id}` },
        (payload) => setBranding(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [screen?.id]);

  // Ticker rotation
  useEffect(() => {
    const messages = branding?.ticker_messages || [];
    if (messages.length === 0) return;
    const speed = (branding?.ticker_speed_sec || 5) * 1000;
    tickRef.current = setInterval(() => setTickerIdx((i) => (i + 1) % messages.length), speed);
    return () => clearInterval(tickRef.current);
  }, [branding?.ticker_messages, branding?.ticker_speed_sec]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!code) return null;

  if (!screen) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Tv className="h-16 w-16 mx-auto mb-4 text-primary animate-pulse" />
          <p>Looking for screen "{code}"...</p>
          <p className="text-xs text-white/50 mt-2">If this persists, check the pair code in your dashboard.</p>
        </div>
      </div>
    );
  }

  const primary = branding?.primary_color || "#5BADE6";
  const textColor = branding?.text_color || "#FFFFFF";
  const tickerMessages = branding?.ticker_messages || [];
  const currentTicker = tickerMessages[tickerIdx];
  const inProgressToken = queue.find((q) => q.status === "in_progress");
  const waitingTokens = queue.filter((q) => q.status === "waiting").slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Video layer */}
      <div className="absolute inset-0 flex items-center justify-center">
        {video ? (
          video.source_type === "upload" || video.source_type === "url" ? (
            <video
              key={video.id}
              src={video.source_url}
              autoPlay
              loop
              muted={(screen.volume || 0) === 0}
              className="w-full h-full object-cover"
            />
          ) : (
            <iframe
              key={video.id}
              src={buildEmbedUrl(video.source_type, video.source_url, screen.is_playing, (screen.volume || 0) === 0)}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
            />
          )
        ) : (
          <div className="text-center text-white/60">
            {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-32 mx-auto mb-6 opacity-80" />}
            <h1 className="text-5xl font-bold" style={{ color: primary }}>{branding?.clinic_name || "Welcome"}</h1>
            {branding?.tagline && <p className="text-2xl mt-3 text-white/70">{branding.tagline}</p>}
            <p className="mt-12 text-sm text-white/40">Screen: {screen.name} • Code: {screen.pair_code}</p>
          </div>
        )}
      </div>

      {/* Top bar — Now Serving / Doctor on Duty / Clock */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent">
        {branding?.show_now_serving && inProgressToken && (
          <div className="rounded-xl px-5 py-2 backdrop-blur-md" style={{ background: primary, color: textColor }}>
            <p className="text-xs opacity-80">NOW SERVING</p>
            <p className="text-3xl font-bold font-mono">#{inProgressToken.token_number}</p>
          </div>
        )}
        <div className="flex-1 text-center">
          {branding?.show_doctor_on_duty && branding?.doctor_on_duty && (
            <div className="inline-block bg-black/60 backdrop-blur-md rounded-full px-5 py-1.5 text-white">
              <span className="text-xs opacity-70">On Duty: </span>
              <span className="font-semibold">{branding.doctor_on_duty}</span>
            </div>
          )}
        </div>
        <div className="bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 text-white text-right">
          <p className="text-2xl font-bold font-mono">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-xs opacity-70">{now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</p>
        </div>
      </div>

      {/* Right side queue panel */}
      {branding?.show_queue_panel && waitingTokens.length > 0 && (
        <div className="absolute top-24 right-4 w-64 bg-black/60 backdrop-blur-md rounded-xl p-3 text-white">
          <p className="text-xs uppercase opacity-70 mb-2">Up Next</p>
          <div className="space-y-1.5">
            {waitingTokens.map((q) => (
              <div key={q.token_number} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-1.5">
                <span className="font-mono font-bold text-lg" style={{ color: primary }}>#{q.token_number}</span>
                <span className="text-sm truncate flex-1">{(q as any).patients?.full_name || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lower-third — uses clinic-selected style (broadcast | minimal | news | cinema) */}
      {screen.show_lower_third && <LowerThird branding={branding} />}
    </div>
  );
}
