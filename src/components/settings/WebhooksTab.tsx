import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Webhook, Plus, Trash2, Save, TestTube, Loader2, CheckCircle2, XCircle,
  Sheet, Zap, Workflow, Globe, Copy, Sparkles
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: "zapier" | "make" | "n8n" | "google_sheets" | "custom";
  enabled: boolean;
  events: string[];
  lastStatus?: "success" | "error" | null;
  lastTriggered?: string | null;
}

const WEBHOOK_EVENTS = [
  { key: "appointment.created", label: "New Appointment" },
  { key: "appointment.updated", label: "Appointment Updated" },
  { key: "appointment.cancelled", label: "Appointment Cancelled" },
  { key: "patient.created", label: "New Patient" },
  { key: "invoice.created", label: "New Invoice" },
  { key: "invoice.paid", label: "Invoice Paid" },
  { key: "treatment.completed", label: "Treatment Completed" },
  { key: "queue.called", label: "Patient Called from Queue" },
];

const WEBHOOK_TYPES: { value: WebhookConfig["type"]; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { value: "zapier", label: "Zapier", icon: <Zap className="w-4 h-4 text-orange-500" />, placeholder: "https://hooks.zapier.com/hooks/catch/..." },
  { value: "make", label: "Make.com", icon: <Workflow className="w-4 h-4 text-purple-600" />, placeholder: "https://hook.eu2.make.com/..." },
  { value: "n8n", label: "n8n", icon: <Workflow className="w-4 h-4 text-red-500" />, placeholder: "https://your-n8n.app/webhook/..." },
  { value: "google_sheets", label: "Google Apps Script", icon: <Sheet className="w-4 h-4 text-green-600" />, placeholder: "https://script.google.com/macros/s/.../exec" },
  { value: "custom", label: "Custom URL", icon: <Globe className="w-4 h-4 text-primary" />, placeholder: "https://your-api.com/webhook" },
];

export default function WebhooksTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [preTesting, setPreTesting] = useState(false);
  const [preTestResult, setPreTestResult] = useState<"success" | "error" | null>(null);
  const [adding, setAdding] = useState(false);
  const [newHook, setNewHook] = useState<Omit<WebhookConfig, "id" | "lastStatus" | "lastTriggered">>({
    name: "", url: "", type: "zapier", enabled: true, events: [],
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic-settings-webhooks", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("setting_key", "webhooks")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings?.setting_value) {
      try { setWebhooks(JSON.parse(settings.setting_value)); } catch {}
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (hooks: WebhookConfig[]) => {
      const value = JSON.stringify(hooks);
      if (settings) {
        const { error } = await supabase.from("clinic_settings").update({ setting_value: value }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings").insert({ clinic_id: clinicId, setting_key: "webhooks", setting_value: value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-settings-webhooks"] });
      toast.success("Webhooks saved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newHook.name.trim() || !newHook.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    if (!newHook.events.length) {
      toast.error("Select at least one event");
      return;
    }
    const hook: WebhookConfig = {
      ...newHook,
      id: crypto.randomUUID(),
      lastStatus: null,
      lastTriggered: null,
    };
    const updated = [...webhooks, hook];
    setWebhooks(updated);
    saveMutation.mutate(updated);
    setNewHook({ name: "", url: "", type: "zapier", enabled: true, events: [] });
    setAdding(false);
  };

  const handleDelete = (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    setWebhooks(updated);
    saveMutation.mutate(updated);
  };

  const handleToggle = (id: string) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWebhooks(updated);
    saveMutation.mutate(updated);
  };

  const handleTest = async (hook: WebhookConfig) => {
    setTesting(hook.id);
    try {
      await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          event: "test",
          clinic_id: clinicId,
          timestamp: new Date().toISOString(),
          data: { message: "Test webhook from DoctorsBuddy" },
        }),
      });
      const updated = webhooks.map(w =>
        w.id === hook.id ? { ...w, lastStatus: "success" as const, lastTriggered: new Date().toISOString() } : w
      );
      setWebhooks(updated);
      saveMutation.mutate(updated);
      toast.success("Test sent! Check your webhook destination to confirm receipt.");
    } catch {
      const updated = webhooks.map(w =>
        w.id === hook.id ? { ...w, lastStatus: "error" as const, lastTriggered: new Date().toISOString() } : w
      );
      setWebhooks(updated);
      saveMutation.mutate(updated);
      toast.error("Failed to send test webhook");
    } finally {
      setTesting(null);
    }
  };

  const SAMPLE_PAYLOADS: Record<string, any> = {
    "appointment.created": {
      event: "appointment.created",
      clinic_id: clinicId,
      timestamp: new Date().toISOString(),
      data: {
        appointment_id: "apt_demo_123",
        patient: { id: "pat_demo_99", name: "Riya Sharma", phone: "9876543210", email: "riya@example.com" },
        doctor: { id: "doc_demo_1", name: "Dr. Mehta" },
        scheduled_at: "2026-06-20T10:30:00+05:30",
        duration_min: 30,
        type: "Consultation",
        status: "scheduled",
      },
    },
    "invoice.paid": {
      event: "invoice.paid",
      clinic_id: clinicId,
      timestamp: new Date().toISOString(),
      data: {
        invoice_id: "inv_demo_555",
        patient: { id: "pat_demo_99", name: "Riya Sharma", phone: "9876543210" },
        amount: 4500, currency: "INR", tax: 0, discount: 500,
        payment_mode: "UPI", paid_at: new Date().toISOString(),
        items: [{ name: "RCT - 36", qty: 1, price: 5000 }],
      },
    },
    "reminder.sent": {
      event: "reminder.sent",
      clinic_id: clinicId,
      timestamp: new Date().toISOString(),
      data: {
        reminder_id: "rem_demo_77",
        channel: "whatsapp",
        template: "appointment_reminder_24h",
        patient: { id: "pat_demo_99", name: "Riya Sharma", phone: "9876543210" },
        appointment_id: "apt_demo_123",
        scheduled_at: "2026-06-20T10:30:00+05:30",
        status: "delivered",
      },
    },
    "social.post.publish": {
      event: "social.post.publish",
      clinic_id: clinicId,
      timestamp: new Date().toISOString(),
      data: {
        post_id: "post_demo_42",
        caption: "Smile makeovers that change lives ✨ Book your consult today!",
        hashtags: ["#dentalcare", "#smilemakeover", "#doctorsbuddy"],
        platforms: ["instagram", "facebook"],
        media: [{ type: "image", url: "https://example.com/media/smile.jpg" }],
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      },
    },
    "slot.availability.booked": {
      event: "slot.availability.booked",
      clinic_id: clinicId,
      timestamp: new Date().toISOString(),
      data: {
        requested_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        timezone: "Asia/Kolkata",
        slot_duration_min: 30,
        available_slots: ["10:00", "10:30", "11:30", "16:00"],
        booked_slot: "10:30",
        patient: { name: "Riya Sharma", phone: "9876543210" },
        intake_form_url: `${window.location.origin}/register/${clinicId ?? "CLINIC_ID"}`,
      },
    },
  };

  const MAKE_TEMPLATES = [
    {
      key: "appointment.created",
      title: "New Appointment → Google Calendar + WhatsApp",
      description: "When a booking happens, create a Google Calendar event and send a WhatsApp confirmation to the patient.",
      modules: ["Webhooks → Custom webhook", "Google Calendar → Create event", "WhatsApp Business → Send template"],
    },
    {
      key: "slot.availability.booked",
      title: "Slot Availability → Book → Send QR Intake Form",
      description:
        "Ask the assistant tool for free slots on a date, let the caller pick one, book it, then WhatsApp the patient the QR intake form link to fill before arrival.",
      modules: [
        "Webhooks → Custom webhook (trigger: slot request)",
        "HTTP → Make a request (assistant tool: check_availability, body {date, timezone})",
        "Iterator → available_slots",
        "Router → slot chosen? / no slots → offer next date",
        "HTTP → Make a request (assistant tool: book_appointment)",
        "WhatsApp Business → Send intake_form_url",
      ],
    },
    {
      key: "invoice.paid",
      title: "Invoice Paid → Sheets + Slack + Drive",
      description: "Log paid invoices to a revenue sheet, post a celebration in Slack, and archive the PDF receipt to Drive.",
      modules: ["Webhooks → Custom webhook", "Google Sheets → Add row", "Slack → Send message", "Google Drive → Upload file"],
    },
    {
      key: "reminder.sent",
      title: "Reminder Sent → Audit Log + Re-engage",
      description: "Track every reminder in an audit sheet and, if status=failed, branch to an SMS fallback via Twilio.",
      modules: ["Webhooks → Custom webhook", "Router", "Google Sheets → Add row", "Twilio → Send SMS"],
    },
    {
      key: "social.post.publish",
      title: "Social Post → Instagram + Facebook + LinkedIn",
      description: "Fan-out the same post to Instagram, Facebook Page and LinkedIn with platform-specific formatting.",
      modules: ["Webhooks → Custom webhook", "Iterator (platforms)", "Instagram for Business → Create photo post", "Facebook Pages → Create post", "LinkedIn → Share update"],
    },
  ];


  const handlePreTest = async () => {
    if (!newHook.url.trim()) {
      toast.error("Paste a webhook URL first");
      return;
    }
    setPreTesting(true);
    setPreTestResult(null);
    try {
      const sampleEvent = newHook.events[0] && SAMPLE_PAYLOADS[newHook.events[0]]
        ? SAMPLE_PAYLOADS[newHook.events[0]]
        : { event: "test", clinic_id: clinicId, timestamp: new Date().toISOString(), data: { message: "Pre-save connectivity test from DoctorsBuddy" } };
      await fetch(newHook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify(sampleEvent),
      });
      setPreTestResult("success");
      toast.success("Test payload sent — open Make.com 'Run once' to confirm receipt.");
    } catch {
      setPreTestResult("error");
      toast.error("Could not reach the webhook URL");
    } finally {
      setPreTesting(false);
    }
  };

  const copyTemplate = (tpl: typeof MAKE_TEMPLATES[number]) => {
    const payload = SAMPLE_PAYLOADS[tpl.key];
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success(`Copied sample "${tpl.key}" payload — paste into Make.com 'Run once'`);
  };

  const useTemplate = (tpl: typeof MAKE_TEMPLATES[number]) => {
    setAdding(true);
    setNewHook({
      name: tpl.title,
      url: "",
      type: "make",
      enabled: true,
      events: [tpl.key],
    });
    setPreTestResult(null);
    setTimeout(() => window.scrollTo({ top: 200, behavior: "smooth" }), 50);
  };

  const typeInfo = (type: WebhookConfig["type"]) => WEBHOOK_TYPES.find(t => t.value === type)!;

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Webhook className="h-5 w-5 text-primary" /> Outgoing Webhooks
              </CardTitle>
              <CardDescription>
                Push clinic events to Google Sheets, Zapier, n8n, or any custom endpoint
              </CardDescription>
            </div>
            <Button onClick={() => setAdding(true)} disabled={adding} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Webhook
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add new webhook form */}
      {adding && (
        <Card className="shadow-card border-0 border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-base">New Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newHook.name} onChange={e => setNewHook(h => ({ ...h, name: e.target.value }))} placeholder="e.g. Appointment → Google Sheet" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newHook.type} onValueChange={(v: any) => setNewHook(h => ({ ...h, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEBHOOK_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={newHook.url}
                onChange={e => setNewHook(h => ({ ...h, url: e.target.value }))}
                placeholder={typeInfo(newHook.type).placeholder}
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger Events</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={newHook.events.includes(ev.key)}
                      onCheckedChange={(checked) => {
                        setNewHook(h => ({
                          ...h,
                          events: checked
                            ? [...h.events, ev.key]
                            : h.events.filter(e => e !== ev.key),
                        }));
                      }}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={handleAdd} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save Webhook
              </Button>
              <Button
                variant="outline"
                onClick={handlePreTest}
                disabled={preTesting || !newHook.url.trim()}
                title="Send a sample payload to verify connectivity before saving"
              >
                {preTesting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <TestTube className="w-4 h-4 mr-2" />}
                Test {newHook.type === "make" ? "Make.com" : ""} webhook
              </Button>
              {preTestResult === "success" && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent — check "Run once" in Make.com
                </span>
              )}
              {preTestResult === "error" && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> URL unreachable
                </span>
              )}
              <Button variant="outline" onClick={() => { setAdding(false); setPreTestResult(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing webhooks */}
      {webhooks.length === 0 && !adding ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center">
            <Webhook className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No webhooks configured yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a webhook to push events to external services</p>
          </CardContent>
        </Card>
      ) : (
        webhooks.map(hook => (
          <Card key={hook.id} className={`shadow-card border-0 ${!hook.enabled ? "opacity-60" : ""}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1">{typeInfo(hook.type).icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{hook.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{typeInfo(hook.type).label}</Badge>
                      {hook.lastStatus === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {hook.lastStatus === "error" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{hook.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {hook.events.map(ev => (
                        <Badge key={ev} variant="outline" className="text-[10px] px-1.5 py-0">
                          {WEBHOOK_EVENTS.find(e => e.key === ev)?.label || ev}
                        </Badge>
                      ))}
                    </div>
                    {hook.lastTriggered && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Last triggered: {new Date(hook.lastTriggered).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(hook)}
                    disabled={testing !== null}
                    className="text-xs"
                  >
                    {testing === hook.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                    Test
                  </Button>
                  <Switch checked={hook.enabled} onCheckedChange={() => handleToggle(hook.id)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(hook.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Make.com prebuilt scenario templates */}
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <Sparkles className="h-4 w-4 text-purple-600" /> Make.com Scenario Templates
          </CardTitle>
          <CardDescription className="text-xs">
            One-click prebuilt scenarios. "Use this" prefills a webhook; "Copy payload" copies a sample JSON to paste into Make.com's <em>Run once</em>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {MAKE_TEMPLATES.map(tpl => (
            <div key={tpl.key} className="rounded-xl border border-border/60 p-3 bg-card hover:border-purple-300 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="font-medium text-sm leading-snug">{tpl.title}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">{tpl.key}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{tpl.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.modules.map(m => (
                  <Badge key={m} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{m}</Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="text-xs h-8" onClick={() => useTemplate(tpl)}>
                  <Plus className="w-3 h-3 mr-1" /> Use this
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => copyTemplate(tpl)}>
                  <Copy className="w-3 h-3 mr-1" /> Copy payload
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Help section */}
      <Card className="shadow-card border-0">
        <CardContent className="py-4">
          <p className="font-medium text-sm mb-2">How to set up:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
            <li><strong>Zapier:</strong> Create a Zap → Trigger: "Webhooks by Zapier" → "Catch Hook" → Copy the webhook URL</li>
            <li><strong>Make.com:</strong> Create a scenario → add "Webhooks → Custom webhook" module → Copy the generated URL</li>
            <li><strong>n8n:</strong> Add a Webhook node → Copy the Production URL</li>
            <li><strong>Google Sheets:</strong> Use Google Apps Script with a doPost function, deploy as web app, and paste the URL</li>
            <li><strong>Custom:</strong> Any HTTP endpoint that accepts POST with JSON body</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
