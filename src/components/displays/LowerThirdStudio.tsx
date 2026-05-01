// Live lower-third preview studio. Lets the clinic:
//  - Try all 4 styles side-by-side
//  - See live changes against a sample background (or current video thumbnail)
//  - Save the chosen style, or push it instantly to all paired screens (broadcast)
//  - Open a fullscreen mode the doctor can show on a TV / cast for explanations.

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Maximize2, Radio, Save, Image as ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildEmbedUrl, isDirectVideo } from "@/lib/video-utils";
import LowerThird, { LOWER_THIRD_STYLES, LowerThirdStyle, LowerThirdBranding } from "./LowerThird";

interface Props {
  branding: LowerThirdBranding | null | undefined;
  clinicId: string | undefined;
  screens: any[];
}

const SAMPLE_BG =
  "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1280&q=70&auto=format&fit=crop";

export default function LowerThirdStudio({ branding, clinicId, screens }: Props) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<LowerThirdStyle>(
    (branding?.lower_third_style as LowerThirdStyle) || "broadcast"
  );
  const [bgMode, setBgMode] = useState<"image" | "video">("image");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

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

  const selectedVideo = videos.find((v: any) => v.id === selectedVideoId);

  const previewBranding = useMemo(
    () => ({ ...(branding || {}), lower_third_style: active }) as LowerThirdBranding,
    [branding, active]
  );

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
      // Save style + force lower-third ON for every screen so the change is visible immediately.
      await supabase.from("display_branding" as any).upsert(
        { clinic_id: clinicId, lower_third_style: active },
        { onConflict: "clinic_id" }
      );
      const { error } = await supabase
        .from("display_screens" as any)
        .update({ show_lower_third: true, command: { type: "refresh_branding" }, command_at: new Date().toISOString() })
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

  const openFullscreen = () => {
    // Presenter window — uses selected video (if any) or sample background.
    const w = window.open("", "_blank", "width=1280,height=720");
    if (!w) return toast.error("Pop-up blocked");

    let bgHtml = `<div class="bg" style="background:url('${SAMPLE_BG}') center/cover no-repeat;filter:brightness(.65)"></div>`;
    if (selectedVideo) {
      if (isDirectVideo(selectedVideo.source_type)) {
        bgHtml = `<video src="${selectedVideo.source_url}" autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`;
      } else {
        const embed = buildEmbedUrl(selectedVideo.source_type, selectedVideo.source_url, true, true);
        bgHtml = `<iframe src="${embed}" allow="autoplay; encrypted-media" style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>`;
      }
    }

    // Inline render of the lower-third matching the active style (simplified — re-uses same colors/text).
    const primary = previewBranding.primary_color || "#5BADE6";
    const text = previewBranding.text_color || "#FFFFFF";
    const name = previewBranding.clinic_name || "Your Clinic";
    const tagline = previewBranding.tagline || "";
    const phone = previewBranding.phone || "";
    const logo = previewBranding.logo_url ? `<img src="${previewBranding.logo_url}" style="height:56px;width:56px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,.1);padding:4px"/>` : "";
    const tickerArr = JSON.stringify(previewBranding.ticker_messages || []);

    let lt = "";
    if (active === "minimal") {
      lt = `<div class="lt" style="position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:12px;padding:12px 24px;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);color:#fff">
        ${previewBranding.logo_url ? `<img src="${previewBranding.logo_url}" style="height:32px;width:32px;border-radius:6px;object-fit:contain;background:rgba(255,255,255,.1);padding:2px"/>` : ""}
        <span style="font-weight:600;color:${primary}">${name}</span>
        ${tagline ? `<span style="font-size:12px;opacity:.7">— ${tagline}</span>` : ""}
        ${phone ? `<span style="margin-left:auto;font-family:monospace;font-size:12px;opacity:.8">${phone}</span>` : ""}
      </div>`;
    } else if (active === "news") {
      lt = `<div class="lt" style="position:absolute;left:0;right:0;bottom:0;display:flex;color:#fff">
        <div style="background:${primary};color:${text};padding:14px 22px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:14px">${name}</div>
        <div id="ticker" style="flex:1;background:rgba(0,0,0,.85);backdrop-filter:blur(10px);padding:14px 18px;font-size:14px"><span style="color:${primary};margin-right:8px">▸</span><span id="tk">${tagline || "Welcome"}</span></div>
        ${phone ? `<div style="background:rgba(0,0,0,.85);padding:14px 18px;font-family:monospace;border-left:1px solid rgba(255,255,255,.1)">☏ ${phone}</div>` : ""}
      </div>`;
    } else if (active === "cinema") {
      lt = `<div class="lt" style="position:absolute;left:24px;bottom:24px;display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);border-radius:8px;padding:8px 16px;color:#fff;border-left:2px solid ${primary}">
        ${previewBranding.logo_url ? `<img src="${previewBranding.logo_url}" style="height:28px;width:28px;border-radius:4px;object-fit:contain"/>` : ""}
        <div style="line-height:1.2"><div style="font-weight:600;font-size:14px">${name}</div>${tagline ? `<div style="font-size:10px;opacity:.7">${tagline}</div>` : ""}</div>
      </div>`;
    } else {
      lt = `<div class="lt" style="position:absolute;left:0;right:0;bottom:0;color:#fff">
        <div id="tickerbar" style="padding:8px 24px;font-size:14px;background:${primary}DD;color:${text};display:none"><span style="opacity:.8;margin-right:8px">●</span><span id="tk"></span></div>
        <div style="display:flex;align-items:center;gap:16px;padding:16px 24px;background:linear-gradient(to top,rgba(0,0,0,.9),rgba(0,0,0,.6))">
          ${logo}
          <div style="flex:1;min-width:0"><div style="font-size:24px;font-weight:700;color:${primary}">${name}</div>${tagline ? `<div style="font-size:14px;opacity:.8">${tagline}</div>` : ""}</div>
          ${phone ? `<div style="text-align:right"><div style="font-size:12px;opacity:.7">Call us</div><div style="font-size:20px;font-weight:700;font-family:monospace">${phone}</div></div>` : ""}
        </div>
      </div>`;
    }

    const html = `<!doctype html><html><head><title>Presenter — ${name}</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>
        body{margin:0;background:#000;font-family:system-ui,-apple-system,sans-serif;color:#fff;overflow:hidden}
        .stage{position:fixed;inset:0}
        .hint{position:fixed;top:16px;left:16px;background:rgba(0,0,0,.5);padding:8px 14px;border-radius:8px;font-size:12px;opacity:.7;z-index:10}
      </style></head><body>
      <div class="stage">${bgHtml}${lt}</div>
      <div class="hint">Presenter • Press F11 for fullscreen • Cast tab via Chrome → Cast</div>
      <script>
        const msgs = ${tickerArr};
        const speed = ${(previewBranding.ticker_speed_sec || 5) * 1000};
        const tk = document.getElementById('tk');
        const bar = document.getElementById('tickerbar');
        if (msgs.length && tk) {
          let i = 0;
          const update = () => { tk.textContent = msgs[i % msgs.length]; if (bar) bar.style.display='block'; i++; };
          update(); setInterval(update, speed);
        }
      </script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    toast.success(selectedVideo ? `Presenter opened with "${selectedVideo.title}"` : "Presenter opened");
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
              Pick a style, preview live with a real video, then save or broadcast to all paired screens.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openFullscreen} className="gap-1.5">
              <Maximize2 className="h-3.5 w-3.5" /> Presenter Mode
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveStyle.mutate()} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <Button size="sm" onClick={() => broadcast.mutate()} className="gap-1.5" disabled={screens.length === 0}>
              <Radio className="h-3.5 w-3.5" /> Broadcast ({screens.length})
            </Button>
          </div>
        </div>

        {/* Style picker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {LOWER_THIRD_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setActive(s.value)}
              className={`text-left rounded-lg border p-3 transition-all ${
                active === s.value
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{s.label}</p>
                {active === s.value && <Badge variant="default" className="text-[9px] h-4 px-1.5">Active</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.description}</p>
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
            isDirectVideo(selectedVideo.source_type) ? (
              <video
                key={selectedVideo.id}
                src={selectedVideo.source_url}
                autoPlay
                loop
                muted
                playsInline
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
          <LowerThird branding={previewBranding} style={active} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tip: pick "Education Video" + a saved video to see exactly how it'll look on the TV. "Presenter Mode" opens the same combo fullscreen — castable to any screen.
        </p>
      </CardContent>
    </Card>
  );
}
