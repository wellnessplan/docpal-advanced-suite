import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, PenLine } from "lucide-react";
import { toast } from "sonner";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sign-treatment-plan`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function PublicTreatmentPlanSign() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`, { headers: { apikey: ANON } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
        if (json.plan?.signature_url) setSigned(true);
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const start = (x: number, y: number) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  const submit = async () => {
    const c = canvasRef.current; if (!c) return;
    const blank = document.createElement("canvas");
    blank.width = c.width; blank.height = c.height;
    if (c.toDataURL() === blank.toDataURL()) {
      toast.error("Please sign before submitting"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${FN_URL}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({ signature: c.toDataURL("image/png") }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Treatment plan signed. Thank you!");
      setSigned(true);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="p-8 text-center">Plan not found.</div>;

  const { plan, patient, clinic, items } = data;
  const total = plan.total_estimated_cost ?? 0;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          {clinic?.logo_url && <img src={clinic.logo_url} alt={clinic.name} className="h-12 mx-auto" />}
          <h1 className="font-heading text-2xl font-bold">{clinic?.name}</h1>
          <p className="text-sm text-muted-foreground">Treatment plan for {patient?.full_name}</p>
        </div>

        <Card><CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{plan.plan_name}</h2>
            <span className="text-sm font-mono">Rs {Number(total).toLocaleString()}</span>
          </div>
          {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
          {items?.length > 0 && (
            <ul className="divide-y border-t pt-2">
              {items.map((it: any) => (
                <li key={it.id} className="py-2 flex justify-between text-sm">
                  <span>{it.treatment_name || it.procedure_name || "Treatment"} {it.tooth_number ? `· #${it.tooth_number}` : ""}</span>
                  <span className="font-mono">Rs {Number(it.cost ?? 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>

        {signed ? (
          <Card className="bg-green-50 border-green-200"><CardContent className="p-6 text-center space-y-2">
            <ShieldCheck className="h-10 w-10 text-green-600 mx-auto" />
            <p className="font-semibold text-green-800">Plan signed and accepted</p>
            <p className="text-xs text-muted-foreground">Your dentist has been notified.</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PenLine className="h-4 w-4" /> Sign below to accept this plan
            </div>
            <canvas
              ref={canvasRef}
              width={600} height={180}
              className="w-full border rounded-lg bg-white touch-none"
              onMouseDown={(e) => start(e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
              onMouseMove={(e) => move(e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
              onMouseUp={end} onMouseLeave={end}
              onTouchStart={(e) => { const r = canvasRef.current!.getBoundingClientRect(); const t = e.touches[0]; start(t.clientX - r.left, t.clientY - r.top); }}
              onTouchMove={(e) => { const r = canvasRef.current!.getBoundingClientRect(); const t = e.touches[0]; move(t.clientX - r.left, t.clientY - r.top); }}
              onTouchEnd={end}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clear}>Clear</Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "I Accept & Sign"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">By signing you agree to proceed with the treatment plan above. A timestamped record is kept.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
