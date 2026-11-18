import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl, isDirectVideo } from "@/lib/video-utils";
import { Tv, WifiOff } from "lucide-react";
import LowerThird from "@/components/displays/LowerThird";

const APP_VERSION = "1.1.0";

// Public TV display screen — no auth. Reads by pair_code, listens to realtime updates.
export default function DisplayScreen() {
  const { code } = useParams();
  const [screen, setScreen] = useState<any>(null);
  const [video, setVideo] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());
  const [videoTime, setVideoTime] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const lastCmdAtRef = useRef<string | null>(null);

  // Register service worker for offline cache (display only)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/display-sw.js").catch(() => {});
  }, []);

  // Online/offline listener
  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => { window.removeEventListener("online", onOn); window.removeEventListener("offline", onOff); };
  }, []);

  // Surface uncaught errors back to the dashboard via last_error
  useEffect(() => {
    const onErr = async (e: ErrorEvent) => {
      if (!code || !screen?.id) return;
      try {
        await (supabase as any).rpc("touch_display_screen_by_pair_code", {
          p_pair_code: code.toUpperCase(),
          p_app_version: APP_VERSION,
          p_error: String(e.message || e.error || "unknown").slice(0, 500),
        });
      } catch {}
    };
    window.addEventListener("error", onErr);
    return () => window.removeEventListener("error", onErr);
  }, [code, screen?.id]);

  // Initial load + heartbeat
  useEffect(() => {
    if (!code) return;
    let mounted = true;

    const loadAll = async () => {
      const { data: s } = await (supabase as any).rpc("get_public_display_screen", {
        p_pair_code: code.toUpperCase(),
      });
      if (!s || !mounted) return;
      setScreen(s);
      lastCmdAtRef.current = (s as any).command_at || null;
      await (supabase as any).rpc("touch_display_screen_by_pair_code", {
        p_pair_code: code.toUpperCase(),
        p_app_version: APP_VERSION,
      });

      const { data: br } = await (supabase as any)
        .rpc("get_display_branding_by_pair", { p_pair_code: code.toUpperCase() });
      setBranding(Array.isArray(br) ? br[0] : br);

      if ((s as any).current_video_id) {
        const { data: v } = await supabase
          .from("education_videos" as any)
          .select("*")
          .eq("id", (s as any).current_video_id)
          .maybeSingle();
        setVideo(v);
      }

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

    const heartbeat = setInterval(async () => {
      try {
        const { data: s } = await (supabase as any).rpc("get_public_display_screen", {
          p_pair_code: code.toUpperCase(),
        });
        if (s) {
          setScreen(s);
          await (supabase as any).rpc("touch_display_screen_by_pair_code", {
            p_pair_code: code.toUpperCase(),
            p_app_version: APP_VERSION,
          });
          loadQueue((s as any).clinic_id);
          const nextVideoId = (s as any).current_video_id;
          if (nextVideoId !== video?.id) {
            if (nextVideoId) {
              const { data: nextVideo } = await supabase
                .from("education_videos" as any)
                .select("*")
                .eq("id", nextVideoId)
                .maybeSingle();
              setVideo(nextVideo);
            } else {
              setVideo(null);
            }
          }
          // Detect & handle remote commands posted while we were offline
          const cmdAt = (s as any).command_at;
          if (cmdAt && cmdAt !== lastCmdAtRef.current) {
            lastCmdAtRef.current = cmdAt;
            handleCommand((s as any).command);
          }
        }
      } catch {}
    }, 15000);

    return () => { mounted = false; clearInterval(heartbeat); };
  }, [code]);

  // Handle remote commands (reload / clear cache / refresh)
  const handleCommand = (cmd: any) => {
    if (!cmd || typeof cmd !== "object") return;
    if (cmd.type === "reload" || cmd.type === "restart") {
      setTimeout(() => window.location.reload(), 500);
    } else if (cmd.type === "clear_cache") {
      navigator.serviceWorker?.controller?.postMessage("clear-cache");
      setTimeout(() => window.location.reload(), 800);
    } else if (cmd.type === "update") {
      navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.update()));
      setTimeout(() => window.location.reload(), 800);
    }
  };

  // Realtime subscription for screen updates
  useEffect(() => {
    if (!screen) return;
    const channel = supabase
      .channel(`display-${screen.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "display_branding", filter: `clinic_id=eq.${screen.clinic_id}` },
        (payload) => setBranding(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [screen?.id]);

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
              onTimeUpdate={(e) => setVideoTime(e.currentTarget.currentTime)}
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

      {/* Top bar */}
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

      {!online && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-500/90 text-black text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 z-50">
          <WifiOff className="h-3.5 w-3.5" /> Offline — playing cached content
        </div>
      )}

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

      {screen.show_lower_third && (() => {
        const showAt = screen.lower_third_show_at_sec || 0;
        const hideAt = screen.lower_third_hide_at_sec;
        const timingActive = video && (video.source_type === "upload" || video.source_type === "url");
        if (timingActive) {
          if (videoTime < showAt) return null;
          if (typeof hideAt === "number" && hideAt > 0 && videoTime >= hideAt) return null;
        }
        return <LowerThird branding={branding} />;
      })()}
    </div>
  );
}
