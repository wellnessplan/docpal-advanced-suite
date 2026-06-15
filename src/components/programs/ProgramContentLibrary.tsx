import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, CalendarClock, BookOpen, Send, Trash2, Repeat, Loader2 } from "lucide-react";

interface Program { id: string; name: string; emoji: string | null; }
interface ContentItem {
  id: string; program_id: string | null; title: string; body: string;
  image_url: string | null; is_template: boolean;
  scheduled_for: string | null; status: string;
  sent_at: string | null; sent_count: number; created_at: string;
}

const DEFAULT_SEND_DAY = 1;
const nextMonthDate = (day: number) => {
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() + 1);
  d.setDate(Math.min(day, 28));
  return d.toISOString().slice(0, 10);
};

export default function ProgramContentLibrary({ programs }: { programs: Program[] }) {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [composer, setComposer] = useState<Partial<ContentItem> | null>(null);

  const { data: items } = useQuery({
    queryKey: ["program_content", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await (supabase.from("program_content") as any)
        .select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      return (data ?? []) as ContentItem[];
    },
    enabled: !!clinicId,
  });

  const scheduled = useMemo(() => (items ?? []).filter((i) => i.status === "scheduled"), [items]);
  const sent = useMemo(() => (items ?? []).filter((i) => i.status === "sent").slice(0, 10), [items]);
  const library = useMemo(() => (items ?? []).filter((i) => i.is_template), [items]);

  const programLabel = (id: string | null) => {
    const p = programs.find((x) => x.id === id);
    return p ? `${p.emoji ?? "🦷"} ${p.name}` : "—";
  };

  const saveItem = useMutation({
    mutationFn: async (payload: Partial<ContentItem> & { mode: "schedule" | "library" | "both" }) => {
      if (!clinicId) throw new Error("No clinic");
      if (!payload.title || !payload.body) throw new Error("Title and body required");
      if ((payload.mode === "schedule" || payload.mode === "both") && !payload.program_id)
        throw new Error("Pick a program to schedule");

      const inserts: any[] = [];
      if (payload.mode === "library" || payload.mode === "both") {
        inserts.push({
          clinic_id: clinicId, program_id: payload.program_id ?? null,
          title: payload.title, body: payload.body, image_url: payload.image_url ?? null,
          is_template: true, status: "draft",
        });
      }
      if (payload.mode === "schedule" || payload.mode === "both") {
        inserts.push({
          clinic_id: clinicId, program_id: payload.program_id!,
          title: payload.title, body: payload.body, image_url: payload.image_url ?? null,
          is_template: false, status: "scheduled",
          scheduled_for: payload.scheduled_for ?? nextMonthDate(DEFAULT_SEND_DAY),
        });
      }
      const { error } = await (supabase.from("program_content") as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["program_content", clinicId] });
      setComposer(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("program_content") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["program_content", clinicId] }),
  });

  const reuse = (item: ContentItem) => {
    setComposer({
      title: item.title, body: item.body,
      image_url: item.image_url, program_id: item.program_id,
      scheduled_for: nextMonthDate(DEFAULT_SEND_DAY),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Campaign Library & Scheduler</CardTitle>
          <p className="text-xs text-muted-foreground">Author monthly posts, schedule fixed-day broadcasts, reuse from your library.</p>
        </div>
        <Button size="sm" onClick={() => setComposer({ scheduled_for: nextMonthDate(DEFAULT_SEND_DAY) })}>
          <Plus className="h-4 w-4 mr-1" />New post
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><CalendarClock className="h-3 w-3" />SCHEDULED ({scheduled.length})</div>
          {scheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nothing scheduled. Plan your next monthly campaign.</p>
          ) : (
            <div className="space-y-2">
              {scheduled.map((i) => (
                <div key={i.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{i.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{i.body}</div>
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{programLabel(i.program_id)}</Badge>
                      <Badge variant="outline">{new Date(i.scheduled_for!).toLocaleDateString()}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate(i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><BookOpen className="h-3 w-3" />LIBRARY ({library.length})</div>
          {library.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No saved templates yet. Save any post to reuse later.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {library.map((i) => (
                <div key={i.id} className="border rounded-lg p-3">
                  <div className="font-medium text-sm">{i.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{i.body}</div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">{programLabel(i.program_id)}</Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => reuse(i)}>
                        <Repeat className="h-3 w-3 mr-1" />Reuse
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate(i.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {sent.length > 0 && (
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Send className="h-3 w-3" />RECENTLY SENT</div>
            <div className="space-y-1">
              {sent.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs border-b pb-1 last:border-0">
                  <span className="truncate">{i.title} <span className="text-muted-foreground">· {programLabel(i.program_id)}</span></span>
                  <span className="text-muted-foreground whitespace-nowrap ml-2">
                    {i.sent_count} sent · {i.sent_at ? new Date(i.sent_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </CardContent>

      <Dialog open={!!composer} onOpenChange={(o) => !o && setComposer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New campaign post</DialogTitle></DialogHeader>
          {composer && (
            <div className="space-y-3">
              <div>
                <Label>Title (internal)</Label>
                <Input value={composer.title ?? ""} onChange={(e) => setComposer({ ...composer, title: e.target.value })} placeholder="e.g. May Dental Tip" />
              </div>
              <div>
                <Label>Program</Label>
                <Select value={composer.program_id ?? ""} onValueChange={(v) => setComposer({ ...composer, program_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a program" /></SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.emoji} {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message — {`{{name}}`} is replaced per patient</Label>
                <Textarea rows={5} value={composer.body ?? ""} onChange={(e) => setComposer({ ...composer, body: e.target.value })} placeholder="Hi {{name}}, this month's tip..." />
              </div>
              <div>
                <Label>Send on (date)</Label>
                <Input type="date" value={composer.scheduled_for ?? ""} onChange={(e) => setComposer({ ...composer, scheduled_for: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Pick any day each month. The 9 AM IST job will broadcast to all active enrollees of that program.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => saveItem.mutate({ ...composer, mode: "library" })} disabled={saveItem.isPending}>
                  {saveItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save to library
                </Button>
                <Button onClick={() => saveItem.mutate({ ...composer, mode: "both" })} disabled={saveItem.isPending}>
                  {saveItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Schedule & save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
