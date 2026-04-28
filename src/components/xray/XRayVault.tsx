import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, FileImage, Trash2, ZoomIn, ZoomOut, RotateCw,
  Maximize2, X, Move, Download, Filter, GitCompare, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import XRayCompareDialog from "./XRayCompareDialog";

interface XRayVaultProps {
  patientId: string;
  clinicId: string;
}

export default function XRayVault({ patientId, clinicId }: XRayVaultProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [toothNumber, setToothNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");
  const [filterTooth, setFilterTooth] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  // Fetch X-ray documents
  const { data: xrays = [], isLoading } = useQuery({
    queryKey: ["xray-documents", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientId)
        .eq("category", "xray")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filteredXrays = filterTooth
    ? xrays.filter((x: any) => x.notes?.includes(`Tooth #${filterTooth}`))
    : xrays;

  // Upload X-ray
  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Select an X-ray image first");

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clinicId}/${patientId}/xray_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const noteText = toothNumber ? `Tooth #${toothNumber}${notes ? " — " + notes : ""}` : notes || null;

      const { error: dbError } = await (supabase.from("patient_documents") as any).insert({
        patient_id: patientId,
        clinic_id: clinicId,
        category: "xray",
        file_url: path,
        file_name: file.name,
        file_type: file.type,
        notes: noteText,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["xray-documents"] });
      toast.success("X-ray uploaded!");
      setNotes("");
      setToothNumber("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  // Delete X-ray
  const deleteXray = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("patient-files").remove([doc.file_url]);
      const { error } = await supabase.from("patient_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xray-documents"] });
      toast.success("X-ray deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Open viewer
  const openViewer = async (doc: any) => {
    const { data } = await supabase.storage.from("patient-files").createSignedUrl(doc.file_url, 3600);
    if (data?.signedUrl) {
      setViewerUrl(data.signedUrl);
      setViewerTitle(doc.file_name);
      setViewerOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card className="shadow-card border-0 border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <FileImage className="h-4 w-4 text-primary" /> X-Ray Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Tooth # (optional)</Label>
              <Input
                type="number"
                placeholder="e.g. 36"
                value={toothNumber}
                onChange={e => setToothNumber(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input
                placeholder="Periapical, panoramic..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" onClick={handleUpload} disabled={uploading} className="gap-1">
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter + Compare */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter by tooth #..."
          value={filterTooth}
          onChange={e => setFilterTooth(e.target.value)}
          className="h-7 text-xs w-32"
        />
        <Badge variant="secondary" className="text-[10px]">{filteredXrays.length} X-rays</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={selectMode ? "default" : "outline"} className="h-7 text-xs"
            onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}>
            <GitCompare className="h-3 w-3 mr-1" /> {selectMode ? "Cancel" : "Compare"}
          </Button>
          {selectMode && (
            <Button size="sm" className="h-7 text-xs" disabled={selectedIds.size < 2 || selectedIds.size > 4}
              onClick={() => setCompareOpen(true)}>
              <Check className="h-3 w-3 mr-1" /> Open ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground p-4">Loading X-rays...</p>
      ) : !filteredXrays.length ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileImage className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No X-rays yet</p>
            <p className="text-xs">Upload your first X-ray image above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {filteredXrays.map((doc: any) => {
            const isSelected = selectedIds.has(doc.id);
            return (
              <div key={doc.id} className={cn("relative", isSelected && "ring-2 ring-primary rounded-lg")}>
                <XRayThumbnail
                  doc={doc}
                  onView={() => {
                    if (selectMode) {
                      setSelectedIds(s => {
                        const n = new Set(s);
                        if (n.has(doc.id)) n.delete(doc.id);
                        else if (n.size < 4) n.add(doc.id);
                        return n;
                      });
                    } else openViewer(doc);
                  }}
                  onDelete={() => deleteXray.mutate(doc)}
                />
                {selectMode && isSelected && (
                  <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {Array.from(selectedIds).indexOf(doc.id) + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <XRayCompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        docs={filteredXrays.filter((d: any) => selectedIds.has(d.id))}
      />

      {/* Magnify Viewer */}
      <XRayViewer
        open={viewerOpen}
        url={viewerUrl}
        title={viewerTitle}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}

/* ---------- Thumbnail Card ---------- */

function XRayThumbnail({
  doc, onView, onDelete,
}: { doc: any; onView: () => void; onDelete: () => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from("patient-files").createSignedUrl(doc.file_url, 3600)
      .then(({ data }) => { if (data?.signedUrl) setThumbUrl(data.signedUrl); });
  }, [doc.file_url]);

  return (
    <Card className="shadow-card border-0 overflow-hidden group cursor-pointer" onClick={onView}>
      <div className="aspect-square bg-muted relative overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={doc.file_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileImage className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <CardContent className="p-2 space-y-1">
        <p className="text-[10px] font-medium truncate">{doc.file_name}</p>
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground">
            {new Date(doc.created_at).toLocaleDateString()}
          </p>
          <Button
            size="icon" variant="ghost"
            className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {doc.notes && (
          <p className="text-[9px] text-muted-foreground line-clamp-1">{doc.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Full-screen Magnify Viewer ---------- */

function XRayViewer({
  open, url, title, onClose,
}: { open: boolean; url: string; title: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [invertColors, setInvertColors] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setInvertColors(false);
    }
  }, [open]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.5, 8));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.5, 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleFit = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 8));
  }, []);

  // Pan/drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    setDragging(true);
    setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return;
    setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  // Download
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-sm font-heading">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] mr-2">{Math.round(zoom * 100)}%</Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRotate} title="Rotate">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleFit} title="Fit">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              className={cn("h-7 w-7", invertColors && "bg-accent")}
              onClick={() => setInvertColors(!invertColors)}
              title="Invert Colors"
            >
              <span className="text-[10px] font-bold">INV</span>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleDownload} title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Image Canvas */}
        <div
          ref={containerRef}
          className={cn(
            "flex-1 overflow-hidden bg-black flex items-center justify-center",
            zoom > 1 ? "cursor-grab" : "cursor-zoom-in",
            dragging && "cursor-grabbing"
          )}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setDragging(false)}
          style={{ height: "calc(95vh - 52px)" }}
        >
          {url && (
            <img
              src={url}
              alt={title}
              draggable={false}
              className="select-none transition-transform duration-150"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                filter: invertColors ? "invert(1)" : "none",
                maxWidth: zoom <= 1 ? "100%" : "none",
                maxHeight: zoom <= 1 ? "100%" : "none",
              }}
            />
          )}
        </div>

        {/* Zoom slider at bottom */}
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-card border-t">
          <ZoomOut className="h-3 w-3 text-muted-foreground" />
          <input
            type="range"
            min="25"
            max="800"
            value={zoom * 100}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            className="w-48 h-1 accent-primary"
          />
          <ZoomIn className="h-3 w-3 text-muted-foreground" />
          <Move className="h-3 w-3 text-muted-foreground ml-2" />
          <span className="text-[10px] text-muted-foreground">Scroll to zoom · Drag to pan</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
