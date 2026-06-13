import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const VARIANT_TONES: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  success: "bg-green-500/15 text-green-700 border-green-500/30",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function AnnouncementsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => ((await supabase.from("platform_announcements" as any).select("*").order("created_at", { ascending: false })).data as any[]) || [],
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase.from("platform_announcements" as any) as any).update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-announcements"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("platform_announcements" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-announcements"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateAnnouncementDialog userId={user?.id} onCreated={() => qc.invalidateQueries({ queryKey: ["platform-announcements"] })} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" />All announcements ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No announcements yet</div>
          ) : rows.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={VARIANT_TONES[r.variant]}>{r.variant}</Badge>
                  <h4 className="font-semibold truncate">{r.title}</h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={r.active} onCheckedChange={(c) => toggle.mutate({ id: r.id, active: c })} />
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.body}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {format(new Date(r.created_at), "MMM d, yyyy")} {r.cta_url && <> · <a className="underline" href={r.cta_url} target="_blank" rel="noreferrer">{r.cta_label || "Link"}</a></>}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateAnnouncementDialog({ userId, onCreated }: { userId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", variant: "info", cta_label: "", cta_url: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("Title and body required");
    setLoading(true);
    const { error } = await (supabase.from("platform_announcements" as any) as any).insert({
      ...form, created_by: userId, active: true,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Broadcast live");
    setForm({ title: "", body: "", variant: "info", cta_label: "", cta_url: "" });
    setOpen(false);
    onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New announcement</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Broadcast to all clinics</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Body</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div>
            <Label>Style</Label>
            <Select value={form.variant} onValueChange={(v) => setForm({ ...form, variant: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (blue)</SelectItem>
                <SelectItem value="success">Success (green)</SelectItem>
                <SelectItem value="warning">Warning (amber)</SelectItem>
                <SelectItem value="critical">Critical (red)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>CTA label</Label><Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} /></div>
            <div><Label>CTA url</Label><Input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Sending…" : "Broadcast"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
