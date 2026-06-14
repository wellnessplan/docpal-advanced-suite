import { useState } from "react";
import { Download, Share2, Printer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tokenNumber: number;
  patientName: string;
  clinicName?: string;
  clinicLogoUrl?: string | null;
  slotLabel?: string; // e.g. "Today at 10:30 AM" or "Walk-in"
  brandColor: string; // hex
  thankYouHeading: string;
}

// Render token card to an offscreen canvas → returns Blob + dataURL
async function renderTokenCanvas(p: Props): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 720, H = 1040;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // bg
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // brand band
  ctx.fillStyle = p.brandColor;
  ctx.fillRect(0, 0, W, 12);

  let y = 80;

  // logo
  if (p.clinicLogoUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = p.clinicLogoUrl!;
      });
      const maxH = 110;
      const ratio = img.width / img.height;
      const h = Math.min(maxH, img.height);
      const w = h * ratio;
      ctx.drawImage(img, (W - w) / 2, y, w, h);
      y += h + 20;
    } catch { /* ignore */ }
  }

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  if (p.clinicName) {
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.fillText(p.clinicName, W / 2, y); y += 40;
  }
  ctx.font = "700 34px Inter, system-ui, sans-serif";
  ctx.fillText(p.thankYouHeading, W / 2, y); y += 60;

  // token box
  const boxX = 80, boxY = y, boxW = W - 160, boxH = 280;
  ctx.fillStyle = p.brandColor + "1A";
  roundRect(ctx, boxX, boxY, boxW, boxH, 24);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.font = "500 20px Inter, system-ui, sans-serif";
  ctx.fillText("Your Token Number", W / 2, boxY + 60);
  ctx.fillStyle = p.brandColor;
  ctx.font = "800 160px Inter, system-ui, sans-serif";
  ctx.fillText(String(p.tokenNumber), W / 2, boxY + 220);
  y = boxY + boxH + 50;

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(p.patientName, W / 2, y); y += 38;
  if (p.slotLabel) {
    ctx.fillStyle = "#475569";
    ctx.font = "400 20px Inter, system-ui, sans-serif";
    ctx.fillText(p.slotLabel, W / 2, y); y += 30;
  }

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 14px Inter, system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleString(), W / 2, H - 40);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  return { blob, dataUrl };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function TokenShareActions(props: Props) {
  const [busy, setBusy] = useState<"save" | "share" | "print" | null>(null);
  const fileName = `token-${props.tokenNumber}-${props.patientName.replace(/\s+/g, "_")}.png`;
  const shareMessage = `Hi ${props.patientName}, your token at ${props.clinicName ?? "the clinic"} is #${props.tokenNumber}${props.slotLabel ? ` for ${props.slotLabel}` : ""}.`;

  const handleSave = async () => {
    setBusy("save");
    try {
      const { dataUrl } = await renderTokenCanvas(props);
      const a = document.createElement("a");
      a.href = dataUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("Token saved to your device");
    } catch (e: any) {
      toast.error("Couldn't save image: " + (e?.message ?? "unknown"));
    } finally { setBusy(null); }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const { blob } = await renderTokenCanvas(props);
      const file = new File([blob], fileName, { type: "image/png" });
      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareMessage, title: "Appointment Token" });
      } else {
        // Fallback — open WhatsApp with text
        const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        toast.message("Opened WhatsApp", { description: "Attach the saved image manually." });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Share failed: " + (e?.message ?? "unknown"));
    } finally { setBusy(null); }
  };

  const handlePrint = async () => {
    setBusy("print");
    try {
      const { dataUrl } = await renderTokenCanvas(props);
      const w = window.open("", "_blank", "width=480,height=720");
      if (!w) { toast.error("Pop-up blocked. Allow pop-ups to print."); return; }
      w.document.write(`<!doctype html><html><head><title>Token #${props.tokenNumber}</title>
        <style>html,body{margin:0;padding:0;background:#fff}
        img{display:block;width:100%;height:auto}
        @media print{@page{margin:8mm}}</style></head>
        <body><img src="${dataUrl}" onload="setTimeout(()=>{window.print();},150)"/></body></html>`);
      w.document.close();
    } catch (e: any) {
      toast.error("Print failed: " + (e?.message ?? "unknown"));
    } finally { setBusy(null); }
  };

  const btn = "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white shadow active:scale-95 transition-transform disabled:opacity-60";

  return (
    <div className="space-y-2 pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Save your token</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={handleSave} disabled={busy !== null}
          className={btn} style={{ background: props.brandColor }}>
          <Download className="h-3.5 w-3.5" /> {busy === "save" ? "..." : "Save"}
        </button>
        <button type="button" onClick={handleShare} disabled={busy !== null}
          className={btn} style={{ background: "#25D366" }}>
          <Share2 className="h-3.5 w-3.5" /> {busy === "share" ? "..." : "Share"}
        </button>
        <button type="button" onClick={handlePrint} disabled={busy !== null}
          className={btn} style={{ background: "#334155" }}>
          <Printer className="h-3.5 w-3.5" /> {busy === "print" ? "..." : "Print"}
        </button>
      </div>
    </div>
  );
}
