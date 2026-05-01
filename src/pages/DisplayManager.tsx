import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tv, Plus, Play, Pause, SkipForward, Volume2, Trash2, Copy, Settings as SettingsIcon, Wifi, WifiOff, Palette } from "lucide-react";
import { toast } from "sonner";
import { generatePairCode } from "@/lib/video-utils";
import LowerThirdStudio from "@/components/displays/LowerThirdStudio";

const ZONES = [
  { value: "waiting_room", label: "Waiting Room" },
  { value: "chair_side", label: "Chair-Side" },
  { value: "reception", label: "Reception" },
  { value: "other", label: "Other" },
];

export default function DisplayManager() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const castVideoId = searchParams.get("castVideo");
  const [addOpen, setAddOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);

  const { data: screens = [] } = useQuery({
    queryKey: ["display-screens", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("display_screens" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
    refetchInterval: 5000,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["education-videos", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("education_videos" as any).select("*").eq("is_active", true);
      return (data || []) as any[];
    },
    enabled: !!clinicId,
  });

  const { data: branding } = useQuery({
    queryKey: ["display-branding", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("display_branding" as any).select("*").eq("clinic_id", clinicId).maybeSingle();
      return data as any;
    },
    enabled: !!clinicId,
  });

  const updateScreen = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("display_screens" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["display-screens"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteScreen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("display_screens" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Screen removed");
      queryClient.invalidateQueries({ queryKey: ["display-screens"] });
    },
  });

  const castVideo = (screenId: string, videoId: string) => {
    updateScreen.mutate({
      id: screenId,
      patch: { current_video_id: videoId, is_playing: true, command: { type: "play_video", video_id: videoId }, command_at: new Date().toISOString() },
    });
    toast.success("Video cast to screen");
  };

  // If user came from "Cast to a Screen" CTA, prompt them to pick a screen
  const [castDialog, setCastDialog] = useState(!!castVideoId);
  useEffect(() => { if (castVideoId) setCastDialog(true); }, [castVideoId]);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" /> Clinic Screens
            </h1>
            <p className="text-muted-foreground text-sm">Manage and control TVs wirelessly. Updates instantly.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBrandingOpen(true)} className="gap-1.5">
              <Palette className="h-4 w-4" /> Lower-Third Branding
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Pair New Screen</Button>
              </DialogTrigger>
              <AddScreenDialog clinicId={clinicId} onClose={() => setAddOpen(false)} />
            </Dialog>
          </div>
        </div>

        {/* How-to */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-sm flex items-start gap-3">
            <Tv className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">How to connect a TV</p>
              <p className="text-muted-foreground text-xs mt-1">
                On any Smart TV, Fire Stick, or laptop browser, open <code className="bg-muted px-1 rounded">{window.location.origin}/display</code> and enter the 6-digit pair code shown on each screen card. The TV updates live as you control it from here.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Lower-third studio (live preview + broadcast + presenter mode) */}
        <LowerThirdStudio branding={branding} clinicId={clinicId} screens={screens} />

        {screens.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground text-sm">
            No screens yet. Click "Pair New Screen" to add your first TV.
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {screens.map((s: any) => {
              const isOnline = s.last_seen_at && (Date.now() - new Date(s.last_seen_at).getTime() < 30000);
              const currentVideo = videos.find((v: any) => v.id === s.current_video_id);
              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{s.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">{s.zone.replace("_", " ")}</p>
                      </div>
                      <Badge variant={isOnline ? "default" : "secondary"} className="text-[10px] gap-1 shrink-0">
                        {isOnline ? <><Wifi className="h-3 w-3" /> Live</> : <><WifiOff className="h-3 w-3" /> Offline</>}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Pair code */}
                    <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Pair code</p>
                        <p className="font-mono font-bold text-lg tracking-widest">{s.pair_code}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(s.pair_code); toast.success("Code copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Current playing */}
                    <div className="space-y-1">
                      <Label className="text-xs">Now Playing</Label>
                      <Select value={s.current_video_id || ""} onValueChange={(vid) => castVideo(s.id, vid)}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Choose a video..." />
                        </SelectTrigger>
                        <SelectContent>
                          {videos.map((v: any) => (
                            <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-1">
                      <Button size="sm" variant={s.is_playing ? "default" : "outline"} className="flex-1 h-8"
                        onClick={() => updateScreen.mutate({ id: s.id, patch: { is_playing: !s.is_playing, command: { type: s.is_playing ? "pause" : "play" }, command_at: new Date().toISOString() } })}>
                        {s.is_playing ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Play</>}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8"
                        onClick={() => updateScreen.mutate({ id: s.id, patch: { command: { type: "next" }, command_at: new Date().toISOString() } })}>
                        <SkipForward className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Volume */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs flex items-center gap-1"><Volume2 className="h-3 w-3" /> Volume</Label>
                        <span className="text-xs text-muted-foreground">{s.volume}%</span>
                      </div>
                      <Slider value={[s.volume]} max={100} step={5}
                        onValueChange={([v]) => updateScreen.mutate({ id: s.id, patch: { volume: v } })} />
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center justify-between text-xs">
                      <span>Show lower-third</span>
                      <Switch checked={s.show_lower_third} onCheckedChange={(c) => updateScreen.mutate({ id: s.id, patch: { show_lower_third: c } })} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Show queue panel</span>
                      <Switch checked={s.show_queue} onCheckedChange={(c) => updateScreen.mutate({ id: s.id, patch: { show_queue: c } })} />
                    </div>

                    <div className="flex gap-1 pt-2 border-t">
                      <Button asChild size="sm" variant="ghost" className="flex-1 h-7 text-xs">
                        <Link to={`/display/${s.pair_code}`} target="_blank">Open Display</Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Remove "${s.name}"?`)) deleteScreen.mutate(s.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Cast video dialog (came from Education page) */}
        <Dialog open={castDialog} onOpenChange={setCastDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cast Video to Screen</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {screens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No screens paired yet. Pair a screen first.</p>
              ) : screens.map((s: any) => (
                <Button key={s.id} variant="outline" className="w-full justify-between"
                  onClick={() => { castVideo(s.id, castVideoId!); setCastDialog(false); }}>
                  <span>{s.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{s.zone.replace("_", " ")}</Badge>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Branding dialog */}
        <BrandingDialog open={brandingOpen} onClose={() => setBrandingOpen(false)} clinicId={clinicId} />
      </div>
    </DashboardLayout>
  );
}

function AddScreenDialog({ clinicId, onClose }: { clinicId: string | undefined; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [zone, setZone] = useState("waiting_room");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!clinicId || !name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("display_screens" as any).insert({
      clinic_id: clinicId,
      name: name.trim(),
      zone,
      pair_code: generatePairCode(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Screen created — open the pair code on your TV");
    queryClient.invalidateQueries({ queryKey: ["display-screens"] });
    onClose();
  };

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Pair a New Screen</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Screen Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception TV" autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Zone</Label>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ZONES.map(z => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={saving} className="w-full">
          {saving ? "Creating..." : "Create & Get Pair Code"}
        </Button>
      </div>
    </DialogContent>
  );
}

function BrandingDialog({ open, onClose, clinicId }: { open: boolean; onClose: () => void; clinicId: string | undefined }) {
  const queryClient = useQueryClient();
  const [b, setB] = useState<any>({
    logo_url: "", clinic_name: "", tagline: "", phone: "",
    ticker_messages: [], doctor_on_duty: "", show_doctor_on_duty: true,
    show_now_serving: true, show_queue_panel: true,
    primary_color: "#5BADE6", text_color: "#FFFFFF", ticker_speed_sec: 5,
  });
  const [tickerInput, setTickerInput] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["display-branding", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("display_branding" as any).select("*").eq("clinic_id", clinicId).maybeSingle();
      return data as any;
    },
    enabled: !!clinicId && open,
  });

  useEffect(() => {
    if (existing) setB({ ...existing, ticker_messages: existing.ticker_messages || [] });
  }, [existing]);

  const save = async () => {
    if (!clinicId) return;
    let logoUrl = b.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${clinicId}/branding-logo.${ext}`;
      const { error } = await supabase.storage.from("clinic-logos").upload(path, logoFile, { upsert: true });
      if (!error) logoUrl = supabase.storage.from("clinic-logos").getPublicUrl(path).data.publicUrl;
    }
    const payload = { ...b, clinic_id: clinicId, logo_url: logoUrl };
    delete payload.updated_at;
    const { error } = await supabase.from("display_branding" as any).upsert(payload, { onConflict: "clinic_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Branding updated — screens refresh instantly");
    queryClient.invalidateQueries({ queryKey: ["display-branding"] });
    onClose();
  };

  const addTicker = () => {
    if (!tickerInput.trim()) return;
    setB({ ...b, ticker_messages: [...b.ticker_messages, tickerInput.trim()] });
    setTickerInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lower-Third Branding</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic Logo</Label>
            <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            {b.logo_url && !logoFile && <img src={b.logo_url} alt="Logo" className="h-12 mt-1 rounded" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Clinic Name</Label>
              <Input value={b.clinic_name || ""} onChange={(e) => setB({ ...b, clinic_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={b.phone || ""} onChange={(e) => setB({ ...b, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={b.tagline || ""} onChange={(e) => setB({ ...b, tagline: e.target.value })} placeholder="Your smile, our priority" />
          </div>
          <div className="space-y-2">
            <Label>Doctor on Duty</Label>
            <Input value={b.doctor_on_duty || ""} onChange={(e) => setB({ ...b, doctor_on_duty: e.target.value })} placeholder="Dr. Sharma" />
          </div>
          <div className="space-y-2">
            <Label>Ticker Messages (rotating)</Label>
            <div className="flex gap-2">
              <Input value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} placeholder="Now offering Invisalign" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTicker())} />
              <Button size="sm" onClick={addTicker}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {b.ticker_messages.map((m: string, i: number) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {m}
                  <button onClick={() => setB({ ...b, ticker_messages: b.ticker_messages.filter((_: any, idx: number) => idx !== i) })}>×</button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <Input type="color" value={b.primary_color} onChange={(e) => setB({ ...b, primary_color: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <Input type="color" value={b.text_color} onChange={(e) => setB({ ...b, text_color: e.target.value })} className="h-10" />
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>Show "Now Serving" token</span>
              <Switch checked={b.show_now_serving} onCheckedChange={(c) => setB({ ...b, show_now_serving: c })} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Show queue panel (next patients)</span>
              <Switch checked={b.show_queue_panel} onCheckedChange={(c) => setB({ ...b, show_queue_panel: c })} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Show doctor on duty</span>
              <Switch checked={b.show_doctor_on_duty} onCheckedChange={(c) => setB({ ...b, show_doctor_on_duty: c })} />
            </div>
          </div>
          <Button onClick={save} className="w-full">Save Branding</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
