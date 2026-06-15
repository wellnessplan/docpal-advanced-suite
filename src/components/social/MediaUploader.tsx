import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Loader2, FileVideo, ImageIcon, Film, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";

export type MediaKind = "image" | "carousel" | "video" | "reel" | "short";

interface Props {
  clinicId: string;
  mediaUrls: string[];
  mediaKind: MediaKind;
  onChange: (urls: string[], kind: MediaKind) => void;
  max?: number;
}

const KIND_LABEL: Record<MediaKind, string> = {
  image: "Image",
  carousel: "Carousel",
  video: "Video",
  reel: "Reel",
  short: "Short",
};

export function MediaUploader({ clinicId, mediaUrls, mediaKind, onChange, max = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const inferKind = (urls: string[]): MediaKind => {
    if (urls.length === 0) return mediaKind;
    const isVid = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
    if (urls.some(isVid)) {
      // keep reel/short if already set
      if (mediaKind === "reel" || mediaKind === "short") return mediaKind;
      return "video";
    }
    return urls.length > 1 ? "carousel" : "image";
  };

  const handleUpload = async (files: FileList) => {
    if (mediaUrls.length + files.length > max) {
      toast.error(`Maximum ${max} files`);
      return;
    }
    setUploading(true);
    try {
      const next: string[] = [...mediaUrls];
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name}: must be under 50MB`);
          continue;
        }
        const ext = file.name.split(".").pop();
        const path = `${clinicId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("social-media").upload(path, file, {
          cacheControl: "3600", upsert: false, contentType: file.type,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("social-media").getPublicUrl(path);
        next.push(data.publicUrl);
      }
      onChange(next, inferKind(next));
      toast.success(`${files.length} uploaded`);
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => {
    const next = mediaUrls.filter((_, idx) => idx !== i);
    onChange(next, inferKind(next));
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...mediaUrls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next, mediaKind);
  };

  const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

  return (
    <div className="space-y-2">
      {/* Kind selector */}
      <div className="flex flex-wrap gap-1.5">
        {(["image", "carousel", "video", "reel", "short"] as MediaKind[]).map(k => (
          <button
            type="button"
            key={k}
            onClick={() => onChange(mediaUrls, k)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              mediaKind === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
            }`}
          >
            {k === "reel" || k === "short" ? <Film className="inline w-3 h-3 mr-1" /> : null}
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {mediaUrls.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {mediaUrls.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); }}
              className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted group cursor-move"
            >
              {isVideoUrl(url) ? (
                <video src={url} muted className="w-full h-full object-cover" />
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              {i === 0 && (
                <Badge className="absolute top-1 left-1 text-[9px] h-4 px-1 bg-primary">Cover</Badge>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                <GripVertical className="w-4 h-4 text-white" />
                <Button type="button" size="icon" variant="destructive" className="h-6 w-6" onClick={() => remove(i)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {mediaUrls.length < max && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:bg-accent/40"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
            </button>
          )}
        </div>
      )}

      {mediaUrls.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:bg-accent/30 transition flex flex-col items-center gap-2 text-sm text-muted-foreground"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <div className="flex gap-2">
                <ImageIcon className="w-5 h-5" />
                <FileVideo className="w-5 h-5" />
              </div>
              <span>Click to upload images or videos (multi-select, max {max}, 50MB each)</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={e => {
          const files = e.target.files;
          if (files && files.length) handleUpload(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
