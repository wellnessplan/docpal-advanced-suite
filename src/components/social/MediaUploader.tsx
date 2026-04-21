import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileVideo, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clinicId: string;
  mediaUrl?: string;
  mediaType?: string;
  onChange: (url: string | null, type: string | null) => void;
}

export function MediaUploader({ clinicId, mediaUrl, mediaType, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clinicId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("social-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("social-media").getPublicUrl(path);
      const type = file.type.startsWith("video/") ? "video" : "image";
      onChange(data.publicUrl, type);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => onChange(null, null);

  return (
    <div className="space-y-2">
      {mediaUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
          {mediaType === "video" ? (
            <video src={mediaUrl} controls className="w-full max-h-48 object-contain bg-black" />
          ) : (
            <img src={mediaUrl} alt="upload" className="w-full max-h-48 object-contain" />
          )}
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute top-1 right-1 h-7 w-7"
            onClick={handleRemove}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:bg-accent/30 transition flex flex-col items-center gap-2 text-sm text-muted-foreground"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <div className="flex gap-2">
                <ImageIcon className="w-5 h-5" />
                <FileVideo className="w-5 h-5" />
              </div>
              <span>Click to upload image or video (max 25MB)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
