import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, QrCode, Settings2, Users, Send, Loader2 } from "lucide-react";
import ProgramContentLibrary from "@/components/programs/ProgramContentLibrary";

interface Program {
  id: string; clinic_id: string; code: string; name: string;
  description: string | null; emoji: string | null; interval_months: number;
  message_template: string; welcome_message: string | null; active: boolean;
}
interface Enrollment {
  id: string; full_name: string; phone: string; program_id: string;
  next_reminder_at: string; reminders_sent: number; status: string;
  created_at: string;
}

const PRESET_LIBRARY = [
  { title: "World Oral Health Day", body: "Hi {{name}}, on World Oral Health Day, we remind you: a 2-minute brush, twice a day, keeps cavities away! 🪥" },
  { title: "Summer Hydration & Teeth", body: "Hi {{name}}, summer tip: sip water instead of sugary drinks — your enamel will thank you! 💧" },
  { title: "Festival Sweets Aftercare", body: "Hi {{name}}, enjoyed festival sweets? Rinse with water and brush after 30 min to protect your teeth. 🍬" },
  { title: "Back-to-School Checkup", body: "Hi {{name}}, kids back to school? Book a quick dental checkup before the term gets busy. 🎒" },
  { title: "Gum Health Awareness", body: "Hi {{name}}, bleeding gums while brushing? Don't ignore it — book a gum check today. 🩺" },
  { title: "Whitening Special", body: "Hi {{name}}, brighten your smile this month with our professional whitening. Reply to book. ✨" },
];

export default function PatientPrograms() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Program | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);

  const publicUrl = useMemo(
    () => clinicId ? `${window.location.origin}/programs/${clinicId}` : "",
    [clinicId]
  );

  const { data: programs, isLoading } = useQuery({
    queryKey: ["patient_programs", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await (supabase.from("patient_programs") as any)
        .select("*").eq("clinic_id", clinicId).order("interval_months");
      return (data ?? []) as Program[];
    },
    enabled: !!clinicId,
  });

  const { data: enrollments } = useQuery({
    queryKey: ["program_enrollments", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await (supabase.from("program_enrollments") as any)
        .select("*").eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as Enrollment[];
    },
    enabled: !!clinicId,
  });

  // Seed defaults if empty
  useEffect(() => {
    if (!clinicId || isLoading) return;
    if (programs && programs.length === 0) {
      (supabase.rpc as any)("seed_default_patient_programs", { p_clinic_id: clinicId })
        .then(() => qc.invalidateQueries({ queryKey: ["patient_programs", clinicId] }));
    }
  }, [clinicId, programs, isLoading, qc]);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase.from("patient_programs") as any)
        .update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient_programs", clinicId] }),
  });

  const saveProgram = useMutation({
    mutationFn: async (p: Program) => {
      const { error } = await (supabase.from("patient_programs") as any)
        .update({
          name: p.name,
          description: p.description,
          interval_months: p.interval_months,
          message_template: p.message_template,
          welcome_message: p.welcome_message,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Program updated");
      qc.invalidateQueries({ queryKey: ["patient_programs", clinicId] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrollmentCount = (pid: string) =>
    (enrollments ?? []).filter((e) => e.program_id === pid && e.status === "active").length;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied — share via WhatsApp or print as QR");
  };

  const usePreset = (preset: { title: string; body: string }) => {
    if (!editing) return;
    setEditing({ ...editing, message_template: preset.body });
    toast.success(`Loaded: ${preset.title}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Patient Programs</h1>
            <p className="text-muted-foreground text-sm">Self-enroll subscriptions with automated WhatsApp reminders.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4 mr-2" />Copy public link</Button>
            <Button variant="outline" onClick={() => setQrFor(publicUrl)}><QrCode className="h-4 w-4 mr-2" />QR code</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 text-sm flex items-center gap-3 flex-wrap">
            <Badge variant="secondary">Public landing</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded">{publicUrl}</code>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Preview</a>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {(programs ?? []).map((p) => (
            <Card key={p.id} className={p.active ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji ?? "🦷"}</span>
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <div className="text-xs text-muted-foreground">Every {p.interval_months} month{p.interval_months > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <Switch checked={p.active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{p.message_template}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{enrollmentCount(p.id)} active</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    <Settings2 className="h-4 w-4 mr-1" />Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Enrollments</CardTitle></CardHeader>
          <CardContent>
            {(enrollments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No enrollments yet. Share your public link to get patients subscribed.</p>
            ) : (
              <div className="space-y-2">
                {(enrollments ?? []).map((e) => {
                  const prog = programs?.find((p) => p.id === e.program_id);
                  return (
                    <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <div className="font-medium text-sm">{e.full_name} <span className="text-muted-foreground font-normal">· {e.phone}</span></div>
                        <div className="text-xs text-muted-foreground">{prog?.emoji} {prog?.name} · next reminder {new Date(e.next_reminder_at).toLocaleDateString()}</div>
                      </div>
                      <Badge variant="secondary"><Send className="h-3 w-3 mr-1" />{e.reminders_sent}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.emoji} Edit {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Description (shown on public page)</Label>
                <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Reminder interval (months)</Label>
                <Input type="number" min={1} max={24} value={editing.interval_months}
                  onChange={(e) => setEditing({ ...editing, interval_months: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Welcome message (sent on enrollment)</Label>
                <Textarea rows={2} value={editing.welcome_message ?? ""} onChange={(e) => setEditing({ ...editing, welcome_message: e.target.value })} />
              </div>
              <div>
                <Label>Reminder message — use {`{{name}}`} for personalization</Label>
                <Textarea rows={4} value={editing.message_template} onChange={(e) => setEditing({ ...editing, message_template: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Quick library (campaign templates)</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PRESET_LIBRARY.map((p) => (
                    <Button key={p.title} size="sm" variant="outline" onClick={() => usePreset(p)}>{p.title}</Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => saveProgram.mutate(editing)} disabled={saveProgram.isPending}>
                  {saveProgram.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan to subscribe</DialogTitle></DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-3">
              <img
                alt="QR"
                className="border rounded-lg"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrFor)}`}
              />
              <code className="text-xs break-all text-center">{qrFor}</code>
              <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4 mr-2" />Copy link</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
