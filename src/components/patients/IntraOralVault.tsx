import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Upload, Trash2, FolderUp, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { patientId: string; clinicId: string; }

export default function IntraOralVault({ patientId, clinicId }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["intraoral", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientId)
        .eq("category", "intraoral")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return toast.error("No image files found");
    setUploading(true);
    setProgress({ done: 0, total: arr.length });
    let success = 0, failed = 0;
    for (const file of arr) {
      try {
        const ext = file.name.split(".").pop();
        const path = `${clinicId}/${patientId}/intraoral_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("patient-files").upload(path, file);
        if (upErr) throw upErr;
        const { error: dbErr } = await (supabase.from("patient_documents") as any).insert({
          patient_id: patientId, clinic_id: clinicId, category: "intraoral",
          file_url: path, file_name: file.name, file_type: file.type,
        });
        if (dbErr) throw dbErr;
        success++;
      } catch (e: any) {
        failed++;
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }
    qc.invalidateQueries({ queryKey: ["intraoral", patientId] });
    if (failed === 0) toast.success(`${success} photo(s) uploaded`);
    else toast.warning(`${success} uploaded, ${failed} failed`);
    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const delMut = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("patient-files").remove([doc.file_url]);
      const { error } = await supabase.from("patient_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intraoral", patientId] });
      toast.success("Photo deleted");
    },
  });

  const openPhoto = async (doc: any) => {
    const { data } = await supabase.storage.from("patient-files").createSignedUrl(doc.file_url, 3600);
    if (data?.signedUrl) {
      setViewerUrl(data.signedUrl);
      setViewerName(doc.file_name);
    }
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> Intra-Oral Photos
          <Badge variant="secondary" className="text-[10px] ml-auto">{photos.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Drag & drop intra-oral images</p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to select multiple files. Supports bulk upload from camera folder.
          </p>
          <div className="flex justify-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Select Files
            </Button>
            <Button size="sm" variant="outline" onClick={() => folderRef.current?.click()}>
              <FolderUp className="h-3.5 w-3.5 mr-1" /> Pick Folder
            </Button>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" hidden onChange={e => e.target.files && handleFiles(e.target.files)} />
          <input ref={folderRef} type="file" multiple accept="image/*" hidden onChange={e => e.target.files && handleFiles(e.target.files)}
            // @ts-ignore
            webkitdirectory="" />
        </div>

        {uploading && (
          <div className="bg-primary/10 rounded-lg p-2 text-xs text-center">
            Uploading {progress.done}/{progress.total}...
            <div className="h-1 bg-primary/20 rounded mt-1 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Gallery */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : photos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No photos yet</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {photos.map((doc: any) => <Thumb key={doc.id} doc={doc} onOpen={() => openPhoto(doc)} onDelete={() => delMut.mutate(doc)} />)}
          </div>
        )}

        {/* Viewer */}
        <Dialog open={!!viewerUrl} onOpenChange={() => setViewerUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            <DialogHeader className="px-4 py-2 border-b">
              <DialogTitle className="text-sm">{viewerName}</DialogTitle>
            </DialogHeader>
            {viewerUrl && <img src={viewerUrl} alt={viewerName} className="w-full max-h-[85vh] object-contain bg-black" />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Thumb({ doc, onOpen, onDelete }: { doc: any; onOpen: () => void; onDelete: () => void; }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("patient-files").createSignedUrl(doc.file_url, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [doc.file_url]);
  return (
    <div className="relative group rounded-lg overflow-hidden aspect-square bg-muted cursor-pointer" onClick={onOpen}>
      {url ? (
        <img src={url} alt={doc.file_name} className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground/40 m-auto absolute inset-0" />
      )}
      <Button
        size="icon" variant="destructive"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
