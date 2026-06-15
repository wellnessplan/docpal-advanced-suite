import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Star, Save, Send, Plus, Pencil, Trash2, Loader2, ExternalLink, BarChart3, MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const DEFAULT_TEMPLATE =
  "Hi {{name}}, thanks for visiting {{clinic}} today! 🌟\n\n" +
  "If we made you smile, would you take 30 seconds to leave us a Google review? " +
  "It truly helps our small practice grow.\n\n{{url}}\n\nReply STOP to opt out.";

const VARS = [
  { token: "{{name}}", label: "Patient name", sample: "Priya Sharma" },
  { token: "{{clinic}}", label: "Clinic name", sample: "Smile Dental" },
  { token: "{{url}}", label: "Google review URL", sample: "https://g.page/r/xxxx/review" },
];

const fillTemplate = (body: string) =>
  VARS.reduce((acc, v) => acc.split(v.token).join(v.sample), body || "");

const REQUIRED_VARS = ["{{url}}"];
const GOOGLE_HOSTS = [
  "g.page", "maps.app.goo.gl", "goo.gl", "google.com", "maps.google.com",
  "search.google.com", "www.google.com",
];

function validateReviewUrl(raw: string): { ok: boolean; reason?: string } {
  const v = (raw ?? "").trim();
  if (!v) return { ok: false, reason: "URL is required" };
  if (v.length > 500) return { ok: false, reason: "URL too long (max 500)" };
  let u: URL;
  try { u = new URL(v); } catch { return { ok: false, reason: "Not a valid URL" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "Must start with https://" };
  const host = u.hostname.toLowerCase();
  const isGoogle = GOOGLE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  if (!isGoogle) return { ok: false, reason: "Must be a Google review link (g.page, maps.app.goo.gl, google.com/maps, …)" };
  return { ok: true };
}

function validateTemplateBody(body: string): { ok: boolean; reason?: string } {
  const b = (body ?? "").trim();
  if (!b) return { ok: false, reason: "Message body required" };
  if (b.length > 2000) return { ok: false, reason: "Message too long (max 2000)" };
  const missing = REQUIRED_VARS.filter((v) => !b.includes(v));
  if (missing.length) return { ok: false, reason: `Template must include ${missing.join(", ")}` };
  return { ok: true };
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

interface Template {
  id: string;
  template_name: string;
  message_body: string;
  enabled: boolean;
  updated_at: string;
}

export default function GoogleReviews() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();

  // ── URL setting ─────────────────────────────────────────────────────────
  const { data: urlSetting } = useQuery({
    queryKey: ["clinic_setting", clinicId, "google_review_url"],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings").select("id, setting_value")
        .eq("clinic_id", clinicId!).eq("setting_key", "google_review_url").maybeSingle();
      return data;
    },
  });
  const [urlInput, setUrlInput] = useState("");
  const reviewUrl = urlInput || (urlSetting?.setting_value as string | undefined) || "";

  const saveUrl = useMutation({
    mutationFn: async (value: string) => {
      if (!clinicId) throw new Error("No clinic");
      const v = validateReviewUrl(value);
      if (!v.ok) throw new Error(v.reason!);
      if (urlSetting?.id) {
        const { error } = await supabase.from("clinic_settings")
          .update({ setting_value: value.trim() }).eq("id", urlSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings")
          .insert({ clinic_id: clinicId, setting_key: "google_review_url", setting_value: value.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Google review URL saved");
      qc.invalidateQueries({ queryKey: ["clinic_setting", clinicId, "google_review_url"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  // ── Templates ───────────────────────────────────────────────────────────
  const { data: templates = [], isLoading: tLoading } = useQuery({
    queryKey: ["google_review_templates", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("id, template_name, message_body, enabled, updated_at")
        .eq("clinic_id", clinicId!)
        .eq("template_type", "google_review")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const saveTemplate = useMutation({
    mutationFn: async (t: Partial<Template>) => {
      if (!clinicId) throw new Error("No clinic");
      const payload = {
        clinic_id: clinicId,
        template_type: "google_review",
        template_name: (t.template_name ?? "Default").trim() || "Default",
        message_body: (t.message_body ?? "").trim(),
        enabled: t.enabled ?? true,
      };
      const bv = validateTemplateBody(payload.message_body);
      if (!bv.ok) throw new Error(bv.reason!);
      if (t.id) {
        const { error } = await supabase.from("whatsapp_templates")
          .update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Template saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["google_review_templates", clinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["google_review_templates", clinicId] });
    },
  });

  const toggleTemplate = useMutation({
    mutationFn: async ({ id, enabled, body }: { id: string; enabled: boolean; body: string }) => {
      // Block enabling a template that fails validation
      if (enabled) {
        const v = validateTemplateBody(body);
        if (!v.ok) throw new Error(`Cannot enable: ${v.reason}`);
      }
      const { error } = await supabase.from("whatsapp_templates")
        .update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google_review_templates", clinicId] }),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const uploadFile = async (file: File) => {
    try {
      const text = await file.text();
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
      setEditing({ template_name: name || "Imported", message_body: text.slice(0, 2000), enabled: true });
      toast.message("Loaded template — review and save");
    } catch {
      toast.error("Could not read file");
    }
  };

  // ── Manual send ────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; full_name: string; phone: string | null } | null>(null);

  const { data: patientHits = [] } = useQuery({
    queryKey: ["patients_picker", clinicId],
    enabled: !!clinicId && pickerOpen,
    queryFn: async () => {
      const { data } = await supabase.from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", clinicId!)
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const sendManual = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Pick a patient");
      const { data, error } = await supabase.functions.invoke("send-google-review-requests", {
        body: { mode: "manual", patient_id: selectedPatient.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Google review request queued for ${selectedPatient?.full_name}`);
      qc.invalidateQueries({ queryKey: ["google_review_metrics", clinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Send failed"),
  });

  // ── Dashboard metrics (last 14 days) ────────────────────────────────────
  const { data: logs = [] } = useQuery({
    queryKey: ["google_review_metrics", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("whatsapp_logs")
        .select("id, status, delivery_status, sent_at")
        .eq("clinic_id", clinicId!)
        .eq("template_name", "google_review_request")
        .gte("sent_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { byDay, totals } = useMemo(() => {
    const days: Record<string, { day: string; queued: number; sent: number; delivered: number; read: number; replied: number; failed: number }> = {};
    const t = { queued: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days[d] = { day: d.slice(5), queued: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
    }
    for (const l of logs as any[]) {
      const d = (l.sent_at ?? "").slice(0, 10);
      const row = days[d]; if (!row) continue;
      const ds = (l.delivery_status ?? l.status ?? "queued").toLowerCase();
      if (ds === "queued") { row.queued++; t.queued++; }
      else if (ds === "sent") { row.sent++; t.sent++; }
      else if (ds === "delivered") { row.delivered++; t.delivered++; }
      else if (ds === "read") { row.read++; t.read++; }
      else if (ds === "replied" || ds === "responded") { row.replied++; t.replied++; }
      else if (ds === "failed" || ds === "error") { row.failed++; t.failed++; }
    }
    return { byDay: Object.values(days), totals: t };
  }, [logs]);

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Star className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Google Review Requests</h1>
            <p className="text-sm text-muted-foreground">Automated 2h post-visit ask + manual sends + templates + analytics.</p>
          </div>
        </header>

        {/* Setting */}
        <ErrorBoundary name="Review URL setting" inline>
          <Card>
            <CardHeader><CardTitle className="text-base">Google Review URL</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Paste your clinic's Google review link (Business Profile → "Get more reviews").
              </Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://g.page/r/your-clinic/review"
                  defaultValue={(urlSetting?.setting_value as string | undefined) ?? ""}
                  onChange={(e) => setUrlInput(e.target.value)}
                  maxLength={500}
                />
                <Button
                  onClick={() => saveUrl.mutate(reviewUrl.trim())}
                  disabled={saveUrl.isPending || !reviewUrl.trim()}
                >
                  {saveUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                {reviewUrl && (
                  <Button variant="outline" asChild>
                    <a href={reviewUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </ErrorBoundary>

        {/* Manual send */}
        <ErrorBoundary name="Manual send" inline>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" /> Send review request now
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[260px] justify-start">
                      {selectedPatient ? `${selectedPatient.full_name} · ${selectedPatient.phone ?? "no phone"}` : "Pick a patient…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[320px]" align="start">
                    <Command>
                      <CommandInput placeholder="Search patients" />
                      <CommandList>
                        <CommandEmpty>No patients found</CommandEmpty>
                        <CommandGroup>
                          {patientHits.map((p: any) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.full_name} ${p.phone ?? ""}`}
                              onSelect={() => { setSelectedPatient(p); setPickerOpen(false); }}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{p.full_name}</span>
                                <span className="text-xs text-muted-foreground">{p.phone ?? "no phone"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={() => sendManual.mutate()}
                  disabled={!selectedPatient || sendManual.isPending || !reviewUrl}
                >
                  {sendManual.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send now (QA)
                </Button>
              </div>
              {!reviewUrl && <p className="text-xs text-destructive">Save a Google review URL above first.</p>}
            </CardContent>
          </Card>
        </ErrorBoundary>

        {/* Dashboard */}
        <ErrorBoundary name="Review metrics" inline>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Last 14 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                {([
                  ["Queued", totals.queued],
                  ["Sent", totals.sent],
                  ["Delivered", totals.delivered],
                  ["Read", totals.read],
                  ["Replied", totals.replied],
                  ["Failed", totals.failed],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <div className="text-xl font-semibold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sent" stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="delivered" stackId="a" fill="#10b981" />
                    <Bar dataKey="read" stackId="a" fill="#6366f1" />
                    <Bar dataKey="replied" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </ErrorBoundary>

        {/* Templates */}
        <ErrorBoundary name="Templates" inline>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Message templates
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="tpl-upload"
                  accept=".txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                />
                <Button variant="outline" size="sm" onClick={() => document.getElementById("tpl-upload")?.click()}>
                  Upload .txt
                </Button>
                <Button size="sm" onClick={() => setEditing({ template_name: "", message_body: DEFAULT_TEMPLATE, enabled: true })}>
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</div>
              ) : templates.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No custom templates yet. The system will use a default message.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{t.template_name}</span>
                          {t.enabled ? <Badge variant="secondary" className="text-[10px]">Active</Badge>
                                     : <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{t.message_body}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={t.enabled} onCheckedChange={(v) => toggleTemplate.mutate({ id: t.id, enabled: v, body: t.message_body })} />
                        <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete template?")) deleteTemplate.mutate(t.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">
                Variables: <code>{"{{name}}"}</code>, <code>{"{{clinic}}"}</code>, <code>{"{{url}}"}</code>. Most-recently-updated active template is used.
              </p>
            </CardContent>
          </Card>
        </ErrorBoundary>
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={editing.template_name ?? ""}
                  maxLength={80}
                  onChange={(e) => setEditing({ ...editing, template_name: e.target.value })}
                  placeholder="e.g. Friendly default"
                />
              </div>
              <div>
                <Label className="text-xs">Message body</Label>
                <Textarea
                  rows={7}
                  maxLength={2000}
                  value={editing.message_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, message_body: e.target.value })}
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARS.map((v) => (
                    <Button key={v.token} type="button" size="sm" variant="outline"
                      onClick={() => setEditing({ ...editing, message_body: (editing.message_body ?? "") + " " + v.token })}>
                      {v.token}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Preview</Label>
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {fillTemplate(editing.message_body ?? "")}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.enabled ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                  />
                  Enabled
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={() => saveTemplate.mutate(editing)} disabled={saveTemplate.isPending}>
                    {saveTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
