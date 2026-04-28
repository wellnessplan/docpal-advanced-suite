import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  docs: any[]; // 2 documents
}

function ImagePane({ doc, sharedZoom, sharedRotation, sharedInvert }: { doc: any; sharedZoom: number; sharedRotation: number; sharedInvert: boolean; }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("patient-files").createSignedUrl(doc.file_url, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [doc.file_url]);

  return (
    <div className="flex-1 overflow-hidden bg-black flex flex-col">
      <div className="px-3 py-1.5 border-b border-white/10 bg-black/60 text-xs text-white flex items-center justify-between">
        <span className="truncate">{doc.file_name}</span>
        <Badge variant="outline" className="text-[9px] border-white/30 text-white/80">
          {new Date(doc.created_at).toLocaleDateString()}
        </Badge>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {url && (
          <img
            src={url}
            draggable={false}
            className="select-none transition-transform duration-150 max-w-full max-h-full"
            style={{
              transform: `scale(${sharedZoom}) rotate(${sharedRotation}deg)`,
              filter: sharedInvert ? "invert(1)" : "none",
            }}
            alt={doc.file_name}
          />
        )}
      </div>
    </div>
  );
}

export default function XRayCompareDialog({ open, onClose, docs }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [invert, setInvert] = useState(false);

  useEffect(() => {
    if (open) { setZoom(1); setRotation(0); setInvert(false); }
  }, [open]);

  // Sort by date so left=oldest (pre), right=newest (post)
  const sorted = [...docs].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 gap-0">
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-sm font-heading">Pre / Post Comparison · {sorted.length} images</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] mr-2">{Math.round(zoom * 100)}%</Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}><ZoomOut className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(8, z + 0.25))}><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setZoom(1); setRotation(0); }}><Maximize2 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className={cn("h-7 w-7", invert && "bg-accent")} onClick={() => setInvert(!invert)}>
              <span className="text-[10px] font-bold">INV</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-1 divide-x divide-white/10" style={{ height: "calc(95vh - 52px)" }}>
          {sorted.map((d, i) => (
            <ImagePane key={d.id} doc={d} sharedZoom={zoom} sharedRotation={rotation} sharedInvert={invert} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
