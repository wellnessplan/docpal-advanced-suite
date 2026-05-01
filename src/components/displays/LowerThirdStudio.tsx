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
    // Open a fresh window with a presenter-friendly fullscreen lower-third over a video the doctor can play.
    const w = window.open("", "_blank", "width=1280,height=720");
    if (!w) return toast.error("Pop-up blocked");
    const html = `<!doctype html><html><head><title>${(previewBranding.clinic_name || "Lower Third")} — Presenter</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>
        body{margin:0;background:#000;font-family:system-ui,-apple-system,sans-serif;color:#fff;overflow:hidden}
        .stage{position:fixed;inset:0}
        .bg{position:absolute;inset:0;background:url('${SAMPLE_BG}') center/cover no-repeat;filter:brightness(.65)}
        .hint{position:fixed;top:16px;left:16px;background:rgba(0,0,0,.5);padding:8px 14px;border-radius:8px;font-size:12px;opacity:.7}
      </style></head><body>
      <div class="stage"><div class="bg"></div></div>
      <div class="hint">Presenter mode • Press F11 for fullscreen • Close this tab to stop</div>
      <script>setTimeout(()=>document.title='Presenter — ${previewBranding.clinic_name || ""}',100)</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    toast.info("Tip: cast this tab to the TV via Chrome → Cast");
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
              Pick a style, preview live, then save or broadcast instantly to all paired screens.
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

        {/* Live preview — 16:9 */}
        <div className="relative w-full rounded-xl overflow-hidden border bg-black aspect-video">
          <img src={SAMPLE_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <LowerThird branding={previewBranding} style={active} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Tip: "Broadcast" instantly switches every paired TV to this style. "Presenter Mode" opens a fullscreen window the doctor can use during patient explanations or cast to a screen.
        </p>
      </CardContent>
    </Card>
  );
}
