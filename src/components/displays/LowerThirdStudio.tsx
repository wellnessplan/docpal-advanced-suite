// Live lower-third preview studio.
// Features:
//  - 6 styles to choose from
//  - Presets: save (style + video + timing + branding overrides), quick-switch
//  - Video player with play/pause/seek/volume — verify lower-third at any moment
//  - Timing: lower-third can show/hide at specific timestamps during the video
//  - Send preview to a specific TV (or broadcast to all)
//  - Presenter Mode (popup) with the same combo

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Maximize2, Radio, Save, Image as ImageIcon, Video, Play, Pause,
  Volume2, VolumeX, Send, Bookmark, Trash2, Plus, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildEmbedUrl, isDirectVideo } from "@/lib/video-utils";
import LowerThird, { LOWER_THIRD_STYLES, LowerThirdStyle, LowerThirdBranding } from "./LowerThird";

interface Props {
  branding: LowerThirdBranding | null | undefined;
  clinicId: string | undefined;
  screens: any[];
}

const SAMPLE_BG =
  "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1280&q=70&auto=format&fit=crop";

const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export default function LowerThirdStudio({ branding, clinicId, screens }: Props) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<LowerThirdStyle>(
    (branding?.lower_third_style as LowerThirdStyle) || "broadcast"
  );
  const [bgMode, setBgMode] = useState<"image" | "video">("image");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedScreenId, setSelectedScreenId] = useState<string>("");

  // Player state (only meaningful for direct/upload videos)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(60);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Timing for lower-third visibility
  const [showAt, setShowAt] = useState(0);
  const [hideAt, setHideAt] = useState<number | "">("");

  // Preset name (for save)
  const [presetName, setPresetName] = useState("");

  const { data: videos = [] } = useQuery({
    queryKey: ["education-videos-studio", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("education_videos" as any)
        .select("id,title,source_type,source_url,thumbnail_url")
        .eq("is_active", true);
      return (data || []) as any[];
    },
    enabled: !!clinicId,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["lt-presets", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lower_third_presets" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!clinicId,
  });

  const selectedVideo = videos.find((v: any) => v.id === selectedVideoId);
  const isPlayable = selectedVideo && isDirectVideo(selectedVideo.source_type);

  const previewBranding = useMemo(
    () => ({ ...(branding || {}), lower_third_style: active }) as LowerThirdBranding,
    [branding, active]
  );

  // Should the lower-third be visible right now based on timing?
  const lowerThirdVisible = useMemo(() => {
    if (!isPlayable) return true;
    if (currentTime < showAt) return false;
    if (typeof hideAt === "number" && hideAt > 0 && currentTime >= hideAt) return false;
    return true;
  }, [isPlayable, currentTime, showAt, hideAt]);

  // Sync video element with player state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
  }, [isPlaying, selectedVideoId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = volume / 100;
  }, [muted, volume]);

  const onSeek = (val: number[]) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  // ---------- Mutations ----------
  const saveStyle = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await supabase
        .from("display_branding" as any)
        .upsert({ clinic_id: clinicId, lower_third_style: active }, { onConflict: "clinic_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Style saved — all screens updated");
      queryClient.invalidateQueries({ queryKey: ["display-branding"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const broadcast = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      await supabase.from("display_branding" as any).upsert(
        { clinic_id: clinicId, lower_third_style: active },
        { onConflict: "clinic_id" }
      );
      const patch: any = {
        show_lower_third: true,
        lower_third_show_at_sec: showAt,
        lower_third_hide_at_sec: typeof hideAt === "number" ? hideAt : null,
        command: { type: "refresh_branding" },
        command_at: new Date().toISOString(),
      };
      if (selectedVideoId) {
        patch.current_video_id = selectedVideoId;
        patch.is_playing = true;
        patch.command = { type: "play_video", video_id: selectedVideoId };
      }
      const { error } = await supabase
        .from("display_screens" as any)
        .update(patch)
        .eq("clinic_id", clinicId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Broadcasting to ${screens.length} screen${screens.length === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["display-branding"] });
      queryClient.invalidateQueries({ queryKey: ["display-screens"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendToScreen = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!selectedScreenId) throw new Error("Pick a screen first");
      await supabase.from("display_branding" as any).upsert(
        { clinic_id: clinicId, lower_third_style: active },
        { onConflict: "clinic_id" }
      );
      const patch: any = {
        show_lower_third: true,
        lower_third_show_at_sec: showAt,
        lower_third_hide_at_sec: typeof hideAt === "number" ? hideAt : null,
        command_at: new Date().toISOString(),
      };
      if (selectedVideoId) {
        patch.current_video_id = selectedVideoId;
        patch.is_playing = true;
        patch.command = { type: "play_video", video_id: selectedVideoId };
      } else {
        patch.command = { type: "refresh_branding" };
      }
      const { error } = await supabase.from("display_screens" as any).update(patch).eq("id", selectedScreenId);
      if (error) throw error;
    },
    onSuccess: () => {
      const sc = screens.find((s) => s.id === selectedScreenId);
      toast.success(`Sent preview to "${sc?.name || "screen"}"`);
      queryClient.invalidateQueries({ queryKey: ["display-screens"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const savePreset = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!presetName.trim()) throw new Error("Name your preset first");
      const { error } = await supabase.from("lower_third_presets" as any).insert({
        clinic_id: clinicId,
        name: presetName.trim(),
        style: active,
        video_id: selectedVideoId || null,
        show_at_sec: showAt,
        hide_at_sec: typeof hideAt === "number" ? hideAt : null,
        branding_overrides: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Preset "${presetName}" saved`);
      setPresetName("");
      queryClient.invalidateQueries({ queryKey: ["lt-presets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lower_third_presets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preset deleted");
      queryClient.invalidateQueries({ queryKey: ["lt-presets"] });
    },
  });

  const loadPreset = (p: any) => {
    setActive(p.style);
    setShowAt(p.show_at_sec || 0);
    setHideAt(p.hide_at_sec ?? "");
    if (p.video_id) {
      setSelectedVideoId(p.video_id);
      setBgMode("video");
    }
    toast.success(`Loaded "${p.name}"`);
  };

  // ---------- Presenter Mode ----------
  const openFullscreen = () => {
    const w = window.open("", "_blank", "width=1280,height=720");
    if (!w) return toast.error("Pop-up blocked");

    let bgHtml = `<div style="position:absolute;inset:0;background:url('${SAMPLE_BG}') center/cover no-repeat;filter:brightness(.65)"></div>`;
    if (selectedVideo) {
      if (isDirectVideo(selectedVideo.source_type)) {
        bgHtml = `<video src="${selectedVideo.source_url}" autoplay loop ${muted ? "muted" : ""} playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`;
      } else {
        const embed = buildEmbedUrl(selectedVideo.source_type, selectedVideo.source_url, true, muted);
        bgHtml = `<iframe src="${embed}" allow="autoplay; encrypted-media" style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>`;
      }
    }

    const html = `<!doctype html><html><head><title>Presenter</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body{margin:0;background:#000;overflow:hidden;font-family:system-ui}</style>
      </head><body>
      <div style="position:fixed;inset:0">${bgHtml}</div>
      <div style="position:fixed;top:16px;left:16px;background:rgba(0,0,0,.5);padding:8px 14px;border-radius:8px;font-size:12px;color:#fff;opacity:.7;z-index:50">Presenter • Press F11 fullscreen • Cast tab via Chrome → Cast</div>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    toast.success(selectedVideo ? `Presenter opened with "${selectedVideo.title}"` : "Presenter opened");
  };

  // Reset timing when switching video
  useEffect(() => {
    setCurrentTime(0);
    setShowAt(0);
    setHideAt("");
  }, [selectedVideoId]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Lower-Third Studio
            </h3>
            <p className="text-xs text-muted-foreground">
              Pick a style, preview with a real video, save presets, and broadcast to one or all screens.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={openFullscreen} className="gap-1.5">
              <Maximize2 className="h-3.5 w-3.5" /> Presenter
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveStyle.mutate()} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save Style
            </Button>
            <Button size="sm" onClick={() => broadcast.mutate()} className="gap-1.5" disabled={screens.length === 0}>
              <Radio className="h-3.5 w-3.5" /> Broadcast All ({screens.length})
            </Button>
          </div>
        </div>

        {/* Style picker — 6 styles, 2x3 on mobile, 3x2 on tablet, 6 wide on lg */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {LOWER_THIRD_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setActive(s.value)}
              className={`text-left rounded-lg border p-2.5 transition-all ${
                active === s.value
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{s.label}</p>
                {active === s.value && <Badge variant="default" className="text-[8px] h-3.5 px-1">On</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{s.description}</p>
            </button>
          ))}
        </div>

        {/* Background source picker */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <div className="flex rounded-md overflow-hidden border">
            <button
              onClick={() => setBgMode("image")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${bgMode === "image" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              <ImageIcon className="h-3 w-3" /> Sample
            </button>
            <button
              onClick={() => setBgMode("video")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-l ${bgMode === "video" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              <Video className="h-3 w-3" /> Education Video
            </button>
          </div>
          {bgMode === "video" && (
            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-[200px]">
                <SelectValue placeholder={videos.length ? "Choose a saved video..." : "No videos saved yet"} />
              </SelectTrigger>
              <SelectContent>
                {videos.map((v: any) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">{v.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Live preview — 16:9 */}
        <div className="relative w-full rounded-xl overflow-hidden border bg-black aspect-video">
          {bgMode === "video" && selectedVideo ? (
            isPlayable ? (
              <video
                ref={videoRef}
                key={selectedVideo.id}
                src={selectedVideo.source_url}
                autoPlay
                loop
                muted={muted}
                playsInline
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <iframe
                key={selectedVideo.id}
                src={buildEmbedUrl(selectedVideo.source_type, selectedVideo.source_url, true, true)}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
              />
            )
          ) : (
            <>
              <img src={SAMPLE_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </>
          )}
          {lowerThirdVisible && <LowerThird branding={previewBranding} style={active} />}
          {!lowerThirdVisible && (
            <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-mono">
              LT hidden ({fmtTime(currentTime)})
            </div>
          )}
        </div>

        {/* Player controls — only for direct uploads */}
        {isPlayable && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsPlaying((p) => !p)}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground w-12 text-right">{fmtTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={onSeek}
                className="flex-1"
              />
              <span className="text-[11px] font-mono text-muted-foreground w-12">{fmtTime(duration)}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[volume]}
                max={100}
                step={5}
                onValueChange={([v]) => { setVolume(v); if (v > 0) setMuted(false); }}
                className="w-24"
              />
            </div>
          </div>
        )}
        {selectedVideo && !isPlayable && (
          <p className="text-[11px] text-muted-foreground italic">
            Player controls (play/pause/seek/volume) only work with direct-uploaded MP4s. YouTube/Vimeo videos play automatically in the embed.
          </p>
        )}

        {/* Timing controls */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary" /> Lower-Third Timing
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px]">Show at (sec)</Label>
              <div className="flex gap-1">
                <Input type="number" min={0} value={showAt} onChange={(e) => setShowAt(Math.max(0, +e.target.value || 0))} className="h-8 text-xs" />
                {isPlayable && (
                  <Button size="sm" variant="outline" className="h-8 text-[10px] px-2" onClick={() => setShowAt(Math.floor(currentTime))}>
                    Now
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Hide at (sec) — blank = never</Label>
              <div className="flex gap-1">
                <Input type="number" min={0} value={hideAt} onChange={(e) => setHideAt(e.target.value === "" ? "" : Math.max(0, +e.target.value))} placeholder="never" className="h-8 text-xs" />
                {isPlayable && (
                  <Button size="sm" variant="outline" className="h-8 text-[10px] px-2" onClick={() => setHideAt(Math.floor(currentTime))}>
                    Now
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            E.g. show LT at 0s, hide at 30s so the closing screen of the video stays clean.
          </p>
        </div>

        {/* Send to selected TV */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Send className="h-3.5 w-3.5 text-primary" /> Send Preview to a TV
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedScreenId} onValueChange={setSelectedScreenId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]">
                <SelectValue placeholder={screens.length ? "Choose a paired screen..." : "No screens paired"} />
              </SelectTrigger>
              <SelectContent>
                {screens.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} <span className="text-muted-foreground">— {s.zone?.replace("_", " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => sendToScreen.mutate()} disabled={!selectedScreenId} className="gap-1.5 h-8">
              <Send className="h-3.5 w-3.5" /> Send to TV
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Pushes the exact video + style + timing combo to the selected TV for testing — without disturbing the others.
          </p>
        </div>

        {/* Presets */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Bookmark className="h-3.5 w-3.5 text-primary" /> Saved Presets ({presets.length})
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Preset name (e.g. RCT explanation, Pediatric waiting...)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={() => savePreset.mutate()} disabled={!presetName.trim()} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
          {presets.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {presets.map((p: any) => {
                const v = videos.find((vd: any) => vd.id === p.video_id);
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs">
                    <button onClick={() => loadPreset(p)} className="flex-1 text-left min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {LOWER_THIRD_STYLES.find((s) => s.value === p.style)?.label || p.style}
                        {v && ` • ${v.title}`}
                        {p.show_at_sec > 0 && ` • from ${p.show_at_sec}s`}
                        {p.hide_at_sec && ` to ${p.hide_at_sec}s`}
                      </p>
                    </button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`Delete preset "${p.name}"?`)) deletePreset.mutate(p.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tip: Save your most-used (style + video + timing) combos as presets. One click loads the entire setup so you can switch between scenarios instantly.
        </p>
      </CardContent>
    </Card>
  );
}
