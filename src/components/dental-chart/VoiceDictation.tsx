import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Sparkles, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SoapResult {
  chief_complaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  gum_condition?: string;
  alignment_condition?: string;
}

interface Props {
  onApply: (soap: SoapResult) => void;
}

// Minimal typing for Web Speech API
type SR = any;

export default function VoiceDictation({ onApply }: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [structuring, setStructuring] = useState(false);
  const [soap, setSoap] = useState<SoapResult | null>(null);
  const [open, setOpen] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const SRClass: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) { setSupported(false); return; }
    const rec = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + " ";
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) setTranscript(prev => (prev + finalChunk).trim() + " ");
      setInterim(interimChunk);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") toast.error(`Mic: ${e.error}`);
      setListening(false);
    };
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  const start = () => {
    setOpen(true);
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); } catch {}
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };

  const structure = async () => {
    const text = (transcript + " " + interim).trim();
    if (text.length < 5) { toast.error("Dictate something first"); return; }
    setStructuring(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-to-soap", {
        body: { transcript: text },
      });
      if (error) throw error;
      if (data?.soap) {
        setSoap(data.soap);
        toast.success("SOAP notes ready");
      } else {
        toast.error("No SOAP returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to structure");
    } finally {
      setStructuring(false);
    }
  };

  const apply = () => {
    if (!soap) return;
    onApply(soap);
    toast.success("Applied to exam");
    reset();
  };

  const reset = () => {
    stop();
    setTranscript(""); setInterim(""); setSoap(null); setOpen(false);
  };

  if (!supported) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1 h-7 text-xs">
        <MicOff className="h-3 w-3" /> Voice not supported
      </Button>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={start} className="gap-1 h-7 text-xs">
        <Mic className="h-3 w-3 text-primary" /> Voice → SOAP
      </Button>
    );
  }

  return (
    <Card className="border-primary/40 shadow-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={listening ? "default" : "secondary"} className="gap-1 text-[10px]">
              {listening ? <><Mic className="h-3 w-3 animate-pulse" /> Listening</> : <><MicOff className="h-3 w-3" /> Paused</>}
            </Badge>
            <span className="text-[10px] text-muted-foreground">Speak naturally — chief complaint, findings, plan</span>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={reset}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        <Textarea
          value={transcript + (interim ? `[${interim}]` : "")}
          onChange={e => setTranscript(e.target.value)}
          rows={3}
          placeholder="Your dictation will appear here..."
          className="text-xs"
        />

        <div className="flex flex-wrap gap-2">
          {listening ? (
            <Button size="sm" variant="secondary" onClick={stop} className="h-7 text-xs gap-1">
              <MicOff className="h-3 w-3" /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={start} className="h-7 text-xs gap-1">
              <Mic className="h-3 w-3" /> Resume
            </Button>
          )}
          <Button
            size="sm" onClick={structure} disabled={structuring || !transcript.trim()}
            className="h-7 text-xs gap-1"
          >
            {structuring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Structure to SOAP
          </Button>
        </div>

        {soap && (
          <div className="space-y-2 border-t pt-2 mt-1">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">SOAP Preview</h4>
            {(["chief_complaint","subjective","objective","assessment","plan"] as const).map(k => (
              soap[k] ? (
                <div key={k}>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{k.replace("_"," ")}</span>
                  <p className="text-xs whitespace-pre-wrap">{soap[k]}</p>
                </div>
              ) : null
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={apply} className="h-7 text-xs">Apply to exam</Button>
              <Button size="sm" variant="ghost" onClick={() => setSoap(null)} className="h-7 text-xs">Discard</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
