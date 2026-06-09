import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Plus, Search, Trash2, Tv, Library, Upload as UploadIcon, Youtube, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { buildEmbedUrl } from "@/lib/video-utils";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "preventive", label: "Preventive" },
  { value: "endodontics", label: "Endodontics / RCT" },
  { value: "restorative", label: "Restorative / Fillings" },
  { value: "implants", label: "Implants" },
  { value: "orthodontics", label: "Orthodontics" },
  { value: "oral_surgery", label: "Oral Surgery" },
  { value: "periodontics", label: "Periodontics / Gums" },
  { value: "cosmetic", label: "Cosmetic" },
  { value: "pediatric", label: "Pediatric" },
];

export default function PatientEducation() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [previewVideo, setPreviewVideo] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["education-videos", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_videos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clinicId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("education_videos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education-videos"] });
      toast.success("Video removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = videos.filter((v: any) => {
    if (v.is_global) return false;
    if (category !== "all" && v.category !== category) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" /> Patient Education
            </h1>
            <p className="text-muted-foreground text-sm">Upload your own videos. Cast to clinic TVs.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/displays"><Tv className="h-4 w-4" /> Manage Screens</Link>
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Video</Button>
              </DialogTrigger>
              <AddVideoDialog clinicId={clinicId} onClose={() => setAddOpen(false)} />
            </Dialog>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos..." className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground text-sm">
              No uploads yet. Click 'Add Video' to upload your own or paste a YouTube URL.
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v: any) => (
                <Card key={v.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div
                    onClick={() => setPreviewVideo(v)}
                    className="relative aspect-video bg-muted cursor-pointer overflow-hidden"
                  >
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <Play className="h-12 w-12 text-primary" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                        {v.media_type === "image" ? <ImageIcon className="h-5 w-5 text-foreground" /> : <Play className="h-5 w-5 text-foreground fill-current" />}
                      </div>
                    </div>
                    <Badge className="absolute top-2 left-2 text-[10px]" variant="default">
                      {v.media_type === "image" ? "Image" : "Mine"}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm line-clamp-2 mb-1">{v.title}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{CATEGORIES.find(c => c.value === v.category)?.label || v.category}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); if (confirm("Remove this video?")) deleteMutation.mutate(v.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!previewVideo} onOpenChange={(o) => !o && setPreviewVideo(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewVideo?.title}</DialogTitle>
            </DialogHeader>
            {previewVideo && (
              <div className="space-y-3">
                <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  {previewVideo.media_type === "image" ? (
                    <img src={previewVideo.source_url} alt={previewVideo.title} className="w-full h-full object-contain" />
                  ) : previewVideo.source_type === "upload" || previewVideo.source_type === "url" ? (
                    <video src={previewVideo.source_url} controls className="w-full h-full" />
                  ) : (
                    <iframe
                      src={buildEmbedUrl(previewVideo.source_type, previewVideo.source_url, true, false)}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  )}
                </div>
                {previewVideo.description && <p className="text-sm text-muted-foreground">{previewVideo.description}</p>}
                <Button asChild className="w-full gap-1.5">
                  <Link to={`/displays?castVideo=${previewVideo.id}`}>
                    <Tv className="h-4 w-4" /> Cast to a Screen
                  </Link>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function AddVideoDialog({ clinicId, onClose }: { clinicId: string | undefined; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"youtube" | "upload" | "image">("youtube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!clinicId || !title.trim()) {
      toast.error("Title and clinic required");
      return;
    }
    setSaving(true);
    try {
      let sourceUrl = url;
      let sourceType = "youtube";
      let thumbnail: string | null = null;
      let mediaType: "video" | "image" = "video";

      if (mode === "youtube") {
        if (!url) { toast.error("Paste a YouTube/Vimeo URL"); setSaving(false); return; }
        if (url.includes("vimeo")) sourceType = "vimeo";
        else sourceType = "youtube";
        const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
        if (ytMatch) thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
      } else if (mode === "image") {
        if (!file) { toast.error("Select an image file"); setSaving(false); return; }
        const ext = file.name.split(".").pop();
        const path = `${clinicId}/img-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("education-videos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("education-videos").getPublicUrl(path);
        sourceUrl = pub.publicUrl;
        thumbnail = pub.publicUrl;
        sourceType = "url";
        mediaType = "image";
      } else {
        if (!file) { toast.error("Select a video file"); setSaving(false); return; }
        const ext = file.name.split(".").pop();
        const path = `${clinicId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("education-videos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("education-videos").getPublicUrl(path);
        sourceUrl = pub.publicUrl;
        sourceType = "upload";
      }

      const { error } = await supabase.from("education_videos" as any).insert({
        clinic_id: clinicId,
        title: title.trim(),
        description: description.trim() || null,
        category,
        source_type: sourceType,
        source_url: sourceUrl,
        thumbnail_url: thumbnail,
        media_type: mediaType,
        is_global: false,
      });
      if (error) throw error;

      toast.success(mediaType === "image" ? "Image added" : "Video added");
      queryClient.invalidateQueries({ queryKey: ["education-videos"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Add Patient Education Media</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1" /> YouTube</TabsTrigger>
            <TabsTrigger value="upload"><UploadIcon className="h-4 w-4 mr-1" /> Video</TabsTrigger>
            <TabsTrigger value="image"><ImageIcon className="h-4 w-4 mr-1" /> Image</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Root Canal — What to Expect" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mode === "youtube" ? (
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
        ) : mode === "image" ? (
          <div className="space-y-2">
            <Label>Image (JPG/PNG, infographics, posters)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Video file (MP4, max 100MB)</Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <Button onClick={handleSubmit} disabled={saving} className="w-full">
          {saving ? "Saving..." : mode === "image" ? "Add Image" : "Add Video"}
        </Button>
      </div>
    </DialogContent>
  );
}
