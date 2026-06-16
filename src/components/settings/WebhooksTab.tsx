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

            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save Webhook
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
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
