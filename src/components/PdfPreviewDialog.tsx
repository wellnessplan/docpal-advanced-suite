import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer, X } from "lucide-react";
import type jsPDF from "jspdf";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A function that returns a freshly built jsPDF document. Called whenever `open` flips to true. */
  buildPdf: () => Promise<jsPDF>;
  title?: string;
  filename?: string;
  onDownload?: () => void | Promise<void>;
  onPrint?: () => void | Promise<void>;
}

/**
 * Generic live PDF preview dialog. Builds the PDF with jsPDF, converts to a
 * Blob URL, and shows it in an embedded iframe. Cleans up the Blob URL on close.
 */
export default function PdfPreviewDialog({
  open,
  onOpenChange,
  buildPdf,
  title = "Preview",
  onDownload,
  onPrint,
}: PdfPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    let currentUrl: string | null = null;

    (async () => {
      setLoading(true);
      setUrl(null);
      try {
        const doc = await buildPdf();
        const blob = doc.output("blob");
        currentUrl = URL.createObjectURL(blob);
        if (!revoked) setUrl(currentUrl);
      } catch (e) {
        console.error("PDF preview build failed", e);
      } finally {
        if (!revoked) setLoading(false);
      }
    })();

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [open, buildPdf]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            {onPrint && (
              <Button size="sm" variant="outline" onClick={() => onPrint()} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            )}
            {onDownload && (
              <Button size="sm" onClick={() => onDownload()} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 bg-muted/30 overflow-hidden">
          {loading || !url ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating preview…
            </div>
          ) : (
            <iframe
              src={url}
              title={title}
              className="w-full h-full border-0 bg-background"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
