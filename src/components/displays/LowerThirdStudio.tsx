// Live lower-third preview studio.
// Features:
//  - 6 styles
//  - Presets: save/load/DUPLICATE (style + video(s) + timing + ticker + opacity + branding overrides)
//  - Per-preset ticker messages (override clinic ticker for this scenario)
//  - Opacity slider for the lower-third layer (so video details aren't hidden)
//  - Video sequence preview: queue multiple education videos and step through them
//  - Player controls: play/pause/seek/volume
//  - Send preview to a specific TV (or broadcast to all)
//  - Presenter Mode (popup)

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Maximize2, Radio, Save, Image as ImageIcon, Video, Play, Pause,
  Volume2, VolumeX, Send, Bookmark, Trash2, Plus, Clock, Copy,
  SkipBack, SkipForward, X, ListVideo, Eye, Download, Upload as UploadIcon,
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
  // Sequence: ordered list of video ids to step through. Index = current.
  const [videoQueue, setVideoQueue] = useState<string[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [addVideoId, setAddVideoId] = useState<string>("");
  const [selectedScreenId, setSelectedScreenId] = useState<string>("");

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(60);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lower-third visibility timing
  const [showAt, setShowAt] = useState(0);
  const [hideAt, setHideAt] = useState<number | "">("");

  // Per-preset overrides
  const [tickerText, setTickerText] = useState(""); // newline separated
  const [opacity, setOpacity] = useState(100);
  const [bannerImageUrl, setBannerImageUrl] = useState<string>("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  // Banner positioning
  const [bannerX, setBannerX] = useState(50);     // 0..100
  const [bannerY, setBannerY] = useState(100);    // 0..100
  const [bannerScale, setBannerScale] = useState(100); // 10..300 (%)
  const [bannerFit, setBannerFit] = useState<"contain" | "cover" | "stretch">("contain");
  const [bannerOpacity, setBannerOpacity] = useState(100); // 0..100
  // Safe-zone + grid guides
  const [showGuides, setShowGuides] = useState(false);
  const [snapGrid, setSnapGrid] = useState(true);

  // Preset name (for save)
  const [presetName, setPresetName] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const currentVideoId = videoQueue[queueIdx];
  const selectedVideo = videos.find((v: any) => v.id === currentVideoId);
  const isPlayable = selectedVideo && isDirectVideo(selectedVideo.source_type);

  // Merge per-preset ticker into branding for the preview
  const previewBranding = useMemo<LowerThirdBranding>(() => {
    const tickerLines = tickerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      ...(branding || {}),
      lower_third_style: active,
      ticker_messages: tickerLines.length ? tickerLines : branding?.ticker_messages || [],
      banner_image_url: bannerImageUrl || branding?.banner_image_url || null,
      banner_x: bannerX,
      banner_y: bannerY,
      banner_scale: bannerScale / 100,
      banner_fit: bannerFit,
      banner_opacity: bannerOpacity / 100,
    };
  }, [branding, active, tickerText, bannerImageUrl, bannerX, bannerY, bannerScale, bannerFit, bannerOpacity]);

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
  }, [isPlaying, currentVideoId]);

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

  const goToClip = (idx: number) => {
    if (idx < 0 || idx >= videoQueue.length) return;
    setQueueIdx(idx);
    setCurrentTime(0);
    setDuration(0);
  };

  const addToQueue = () => {
    if (!addVideoId) return;
    setVideoQueue((q) => [...q, addVideoId]);
    setAddVideoId("");
    if (videoQueue.length === 0) {
      setBgMode("video");
      setQueueIdx(0);
    }
  };

  const removeFromQueue = (idx: number) => {
    setVideoQueue((q) => q.filter((_, i) => i !== idx));
    if (queueIdx >= idx && queueIdx > 0) setQueueIdx((i) => i - 1);
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
      if (currentVideoId) {
        patch.current_video_id = currentVideoId;
        patch.is_playing = true;
        patch.command = { type: "play_video", video_id: currentVideoId };
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
      if (currentVideoId) {
        patch.current_video_id = currentVideoId;
        patch.is_playing = true;
        patch.command = { type: "play_video", video_id: currentVideoId };
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

  const tickerLines = tickerText.split("\n").map((l) => l.trim()).filter(Boolean);

  const buildPresetPayload = (name: string) => ({
    clinic_id: clinicId,
    name,
    style: active,
    video_id: videoQueue[0] || null,
    video_ids: videoQueue,
    show_at_sec: showAt,
    hide_at_sec: typeof hideAt === "number" ? hideAt : null,
    ticker_messages: tickerLines,
    opacity: opacity / 100,
    banner_image_url: bannerImageUrl || null,
    branding_overrides: {},
  });

  const savePreset = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!presetName.trim()) throw new Error("Name your preset first");
      const { error } = await supabase
        .from("lower_third_presets" as any)
        .insert(buildPresetPayload(presetName.trim()));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Preset "${presetName}" saved`);
      setPresetName("");
      queryClient.invalidateQueries({ queryKey: ["lt-presets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicatePreset = useMutation({
    mutationFn: async (p: any) => {
      if (!clinicId) throw new Error("No clinic");
      const { id, created_at, updated_at, ...rest } = p;
      const { error } = await supabase.from("lower_third_presets" as any).insert({
        ...rest,
        name: `${p.name} (copy)`,
      });
      if (error) throw error;
    },
    onSuccess: (_d, p: any) => {
      toast.success(`Duplicated "${p.name}"`);
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
    setTickerText(((p.ticker_messages as string[]) || []).join("\n"));
    setOpacity(typeof p.opacity === "number" ? Math.round(p.opacity * 100) : 100);
    setBannerImageUrl(p.banner_image_url || "");
    const ids: string[] = (p.video_ids && p.video_ids.length ? p.video_ids : (p.video_id ? [p.video_id] : []));
    setVideoQueue(ids);
    setQueueIdx(0);
    if (ids.length) setBgMode("video");
    toast.success(`Loaded "${p.name}"`);
  };

  // ---------- Banner image upload ----------
  const uploadBanner = async (file: File) => {
    if (!clinicId) return;
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clinicId}/banner-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("education-videos").upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from("education-videos").getPublicUrl(path);
      setBannerImageUrl(pub.publicUrl);
      toast.success("Banner uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  // ---------- Export / Import presets ----------
  const exportPresets = () => {
    if (!presets.length) return toast.error("No presets to export");
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      presets: presets.map((p: any) => {
        const { id, clinic_id, created_at, updated_at, video_id, ...rest } = p;
        return rest;
      }),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lower-third-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${presets.length} preset${presets.length === 1 ? "" : "s"}`);
  };

  const importPresets = useMutation({
    mutationFn: async (file: File) => {
      if (!clinicId) throw new Error("No clinic");
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: any[] = Array.isArray(parsed) ? parsed : parsed.presets || [];
      if (!list.length) throw new Error("No presets found in file");
      // Strip ids/clinic and remap video_id/video_ids (may not exist in this clinic)
      const rows = list.map((p) => ({
        clinic_id: clinicId,
        name: p.name || "Imported preset",
        style: p.style || "broadcast",
        show_at_sec: p.show_at_sec || 0,
        hide_at_sec: p.hide_at_sec ?? null,
        ticker_messages: p.ticker_messages || [],
        opacity: typeof p.opacity === "number" ? p.opacity : 1,
        banner_image_url: p.banner_image_url || null,
        sort_order: p.sort_order || 0,
        branding_overrides: p.branding_overrides || {},
        // Skip foreign-keyed video refs since they belong to the source clinic
        video_id: null,
        video_ids: [],
      }));
      const { error } = await supabase.from("lower_third_presets" as any).insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} preset${n === 1 ? "" : "s"}. Re-attach videos as needed.`);
      queryClient.invalidateQueries({ queryKey: ["lt-presets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      <style>body{margin:0;background:#000;overflow:hidden;font-family:system-ui}</style>
      </head><body>
      <div style="position:fixed;inset:0">${bgHtml}</div>
      <div style="position:fixed;top:16px;left:16px;background:rgba(0,0,0,.5);padding:8px 14px;border-radius:8px;font-size:12px;color:#fff;opacity:.7;z-index:50">Presenter • Press F11 fullscreen • Cast tab via Chrome → Cast</div>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    toast.success(selectedVideo ? `Presenter opened with "${selectedVideo.title}"` : "Presenter opened");
  };

  // Reset playback timing when switching clip
  useEffect(() => {
    setCurrentTime(0);
  }, [currentVideoId]);

  // Auto-advance to next clip in sequence when current ends
  const onEnded = () => {
    if (queueIdx < videoQueue.length - 1) {
      goToClip(queueIdx + 1);
    } else if (videoQueue.length > 1) {
      goToClip(0); // loop sequence
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Lower-Third Studio
            </h3>
            <p className="text-xs text-muted-foreground">
              Style + video sequence + ticker + timing — preview, save as preset, broadcast.
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

        {/* Style picker */}
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
              <Video className="h-3 w-3" /> Education Video{videoQueue.length > 1 ? "s" : ""}
            </button>
          </div>
          {bgMode === "video" && (
            <div className="flex flex-1 min-w-[200px] gap-1">
              <Select value={addVideoId} onValueChange={setAddVideoId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={videos.length ? "Add video to sequence..." : "No videos saved yet"} />
                </SelectTrigger>
                <SelectContent>
                  {videos.map((v: any) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={addToQueue} disabled={!addVideoId} className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Video sequence list */}
        {bgMode === "video" && videoQueue.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold flex items-center gap-1.5">
                <ListVideo className="h-3.5 w-3.5 text-primary" /> Sequence ({videoQueue.length})
              </p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => goToClip(queueIdx - 1)} disabled={queueIdx === 0}>
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => goToClip(queueIdx + 1)} disabled={queueIdx >= videoQueue.length - 1}>
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { setVideoQueue([]); setQueueIdx(0); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {videoQueue.map((vid, i) => {
                const v = videos.find((x: any) => x.id === vid);
                return (
                  <div
                    key={`${vid}-${i}`}
                    className={`shrink-0 flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] ${
                      i === queueIdx ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                    }`}
                  >
                    <button onClick={() => goToClip(i)} className="font-mono">{i + 1}.</button>
                    <button onClick={() => goToClip(i)} className="truncate max-w-[140px]">{v?.title || "?"}</button>
                    <button onClick={() => removeFromQueue(i)} className="opacity-60 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live preview — 16:9 */}
        <div className="relative w-full rounded-xl overflow-hidden border bg-black aspect-video">
          {bgMode === "video" && selectedVideo ? (
            isPlayable ? (
              <video
                ref={videoRef}
                key={selectedVideo.id}
                src={selectedVideo.source_url}
                autoPlay
                muted={muted}
                playsInline
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={onEnded}
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
          {lowerThirdVisible && <LowerThird branding={previewBranding} style={active} opacity={opacity / 100} />}
          {!lowerThirdVisible && (
            <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-mono">
              LT hidden ({fmtTime(currentTime)})
            </div>
          )}
          {videoQueue.length > 1 && selectedVideo && (
            <div className="absolute top-3 right-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-mono">
              Clip {queueIdx + 1}/{videoQueue.length}
            </div>
          )}
        </div>

        {/* Player controls */}
        {isPlayable && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => goToClip(queueIdx - 1)} disabled={queueIdx === 0}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsPlaying((p) => !p)}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => goToClip(queueIdx + 1)} disabled={queueIdx >= videoQueue.length - 1}>
                <SkipForward className="h-4 w-4" />
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground w-12 text-right">{fmtTime(currentTime)}</span>
              <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={onSeek} className="flex-1" />
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
            Player controls only work with direct-uploaded MP4s. YouTube/Vimeo videos play automatically.
          </p>
        )}

        {/* Per-preset overrides: ticker + opacity */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Ticker messages (this preset)</Label>
              <span className="text-[10px] text-muted-foreground">{tickerLines.length} lines</span>
            </div>
            <Textarea
              value={tickerText}
              onChange={(e) => setTickerText(e.target.value)}
              placeholder={`One message per line.\nLeave empty to use clinic-wide ticker.`}
              rows={4}
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Overrides the default scrolling ticker for this scenario only.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" /> Overlay Opacity
              </Label>
              <span className="text-[11px] font-mono">{opacity}%</span>
            </div>
            <Slider value={[opacity]} min={20} max={100} step={5} onValueChange={([v]) => setOpacity(v)} />
            <p className="text-[10px] text-muted-foreground">
              Lower it when the video has critical visual details that the lower-third would otherwise block.
            </p>
          </div>
        </div>

        {/* Banner image (used when style = Image, otherwise saved with preset) */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-primary" /> Lower-Third Banner Image
              {active === "image" && <Badge variant="default" className="text-[8px] h-3.5 px-1">Active style</Badge>}
            </Label>
            {bannerImageUrl && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => setBannerImageUrl("")}>
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="file"
              accept="image/*"
              disabled={uploadingBanner}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); }}
              className="h-8 text-xs flex-1"
            />
            {bannerImageUrl && (
              <img src={bannerImageUrl} alt="banner" className="h-10 rounded border object-contain bg-black" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Upload a wide PNG/JPG banner (e.g. 1920×360). Saved with the preset; switch style to <b>Image Banner</b> to display it.
          </p>
        </div>

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
            Timing is per clip — when the sequence advances, the timing resets and re-applies to the next video.
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
            Sends the current clip + style + timing to the selected TV.
          </p>
        </div>

        {/* Presets */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Bookmark className="h-3.5 w-3.5 text-primary" /> Saved Presets ({presets.length})
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={exportPresets} disabled={!presets.length}>
                <Download className="h-3 w-3" /> Export
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => importInputRef.current?.click()}>
                <UploadIcon className="h-3 w-3" /> Import
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importPresets.mutate(f);
                  if (e.target) e.target.value = "";
                }}
              />
            </div>
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
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
              {presets.map((p: any) => {
                const ids: string[] = (p.video_ids?.length ? p.video_ids : (p.video_id ? [p.video_id] : []));
                const titles = ids.map((id) => videos.find((vd: any) => vd.id === id)?.title).filter(Boolean);
                return (
                  <div key={p.id} className="flex items-center gap-1.5 rounded border bg-background px-2 py-1.5 text-xs">
                    <button onClick={() => loadPreset(p)} className="flex-1 text-left min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {LOWER_THIRD_STYLES.find((s) => s.value === p.style)?.label || p.style}
                        {titles.length === 1 && ` • ${titles[0]}`}
                        {titles.length > 1 && ` • ${titles.length} clips`}
                        {p.show_at_sec > 0 && ` • from ${p.show_at_sec}s`}
                        {p.hide_at_sec && ` to ${p.hide_at_sec}s`}
                        {typeof p.opacity === "number" && p.opacity < 1 && ` • ${Math.round(p.opacity * 100)}% opacity`}
                        {p.ticker_messages?.length ? ` • ${p.ticker_messages.length} ticker` : ""}
                      </p>
                    </button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicate"
                      onClick={() => duplicatePreset.mutate(p)}>
                      <Copy className="h-3 w-3" />
                    </Button>
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
          Tip: Duplicate a preset to quickly tweak only the style or timing for a related scenario.
        </p>
      </CardContent>
    </Card>
  );
}
