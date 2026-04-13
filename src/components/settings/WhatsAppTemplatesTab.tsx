import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Save, RotateCcw } from "lucide-react";

const DEFAULT_TEMPLATES = [
  { template_name: "appt_reminder_24h", template_type: "reminder", timing_offset_hours: 24, message_body: "Hi {{patient_name}}, this is a reminder for your dental appointment tomorrow ({{date}}) at {{time}}. Please be on time. — Your dental clinic" },
  { template_name: "post_treatment_followup", template_type: "followup", timing_offset_hours: 72, message_body: "Hi {{patient_name}}, we hope you're recovering well after your {{treatment}}. Please follow the post-care instructions. Contact us if you have any concerns." },
  { template_name: "recall_6month", template_type: "recall", timing_offset_hours: 4320, message_body: "Hi {{patient_name}}, it's been 6 months since your last visit. Regular dental checkups help prevent issues. Book your appointment today!" },
  { template_name: "brush_change_reminder", template_type: "reminder", timing_offset_hours: 2160, message_body: "Hi {{patient_name}}, it's been 3 months since your scaling. Time to change your toothbrush for better oral hygiene!" },
  { template_name: "payment_due_reminder", template_type: "payment", timing_offset_hours: 48, message_body: "Hi {{patient_name}}, your payment of ₹{{amount}} is due on {{due_date}}. Please make the payment at your earliest convenience." },
  { template_name: "birthday_greeting", template_type: "greeting", timing_offset_hours: 0, message_body: "Happy Birthday {{patient_name}}! 🎂 Wishing you a wonderful year filled with smiles. — Your dental clinic" },
];

const TEMPLATE_LABELS: Record<string, string> = {
  appt_reminder_24h: "24h Appointment Reminder",
  post_treatment_followup: "Post-Treatment Follow-up (3 days)",
  recall_6month: "6-Month Recall",
  brush_change_reminder: "Brush Change Reminder (3 months)",
  payment_due_reminder: "EMI/Payment Due Reminder",
  birthday_greeting: "Birthday Greeting",
};

export default function WhatsAppTemplatesTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [wabaToken, setWabaToken] = useState("");
  const [wabaPhoneId, setWabaPhoneId] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  const { data: credSettings } = useQuery({
    queryKey: ["clinic-settings-waba", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_settings").select("*").eq("clinic_id", clinicId).in("setting_key", ["waba_token", "waba_phone_id"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (credSettings) {
      credSettings.forEach((s: any) => {
        if (s.setting_key === "waba_token") setWabaToken(s.setting_value || "");
        if (s.setting_key === "waba_phone_id") setWabaPhoneId(s.setting_value || "");
      });
    }
  }, [credSettings]);

  const saveCredentials = async () => {
    setSavingCreds(true);
    const items = [
      { key: "waba_token", value: wabaToken },
      { key: "waba_phone_id", value: wabaPhoneId },
    ];
    for (const item of items) {
      const existing = credSettings?.find((s: any) => s.setting_key === item.key);
      if (existing) {
        await supabase.from("clinic_settings").update({ setting_value: item.value }).eq("id", (existing as any).id);
      } else {
        await supabase.from("clinic_settings").insert({ clinic_id: clinicId, setting_key: item.key, setting_value: item.value });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["clinic-settings-waba"] });
    toast.success("WhatsApp API credentials saved!");
    setSavingCreds(false);
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const [edits, setEdits] = useState<Record<string, { message_body: string; enabled: boolean; timing_offset_hours: number }>>({});

  useEffect(() => {
    if (templates) {
      const map: typeof edits = {};
      templates.forEach(t => {
        map[t.template_name] = {
          message_body: t.message_body,
          enabled: t.enabled,
          timing_offset_hours: t.timing_offset_hours,
        };
      });
      setEdits(map);
    }
  }, [templates]);

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_TEMPLATES.map(t => ({ ...t, clinic_id: clinicId, enabled: true }));
      const { error } = await supabase.from("whatsapp_templates").upsert(rows as any, { onConflict: "clinic_id,template_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Default templates loaded!");
    },
    onError: () => toast.error("Failed to load defaults"),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ templateName, data }: { templateName: string; data: any }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update(data)
        .eq("clinic_id", clinicId)
        .eq("template_name", templateName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template updated!");
    },
    onError: () => toast.error("Failed to update template"),
  });

  const handleToggle = (name: string, enabled: boolean) => {
    setEdits(prev => ({ ...prev, [name]: { ...prev[name], enabled } }));
    updateTemplate.mutate({ templateName: name, data: { enabled } });
  };

  const handleSave = (name: string) => {
    const edit = edits[name];
    if (!edit) return;
    updateTemplate.mutate({
      templateName: name,
      data: { message_body: edit.message_body, timing_offset_hours: edit.timing_offset_hours },
    });
  };

  if (isLoading) return <div className="text-muted-foreground p-4">Loading templates...</div>;

  const hasTemplates = templates && templates.length > 0;

  return (
    <div className="space-y-4">
      {/* WABA Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" /> WhatsApp Business API Credentials
          </CardTitle>
          <CardDescription>
            Enter your clinic's WhatsApp Business API token and Phone Number ID. These are specific to your clinic's WABA account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">API Token</Label>
            <Input
              type="password"
              value={wabaToken}
              onChange={e => setWabaToken(e.target.value)}
              placeholder="EAAxxxxxxx..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
            <Input
              value={wabaPhoneId}
              onChange={e => setWabaPhoneId(e.target.value)}
              placeholder="1234567890"
            />
          </div>
          <Button size="sm" onClick={saveCredentials} disabled={savingCreds}>
            <Save className="h-3.5 w-3.5 mr-1" /> {savingCreds ? "Saving..." : "Save Credentials"}
          </Button>
          {(!wabaToken || !wabaPhoneId) && (
            <p className="text-xs text-amber-600">⚠ Without credentials, messages will be logged as "simulated" and not actually sent.</p>
          )}
        </CardContent>
      </Card>

      {/* Templates Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> WhatsApp Automation Templates
          </CardTitle>
          <CardDescription>
            Configure automated WhatsApp messages. Use {"{{patient_name}}"}, {"{{date}}"}, {"{{time}}"}, {"{{treatment}}"}, {"{{amount}}"}, {"{{due_date}}"} as placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasTemplates ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">No templates configured yet.</p>
              <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" /> Load Default Templates
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map(t => {
                const edit = edits[t.template_name];
                if (!edit) return null;
                return (
                  <Card key={t.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{TEMPLATE_LABELS[t.template_name] || t.template_name}</h4>
                          <Badge variant={edit.enabled ? "default" : "secondary"} className="text-[10px]">
                            {edit.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <Switch checked={edit.enabled} onCheckedChange={(v) => handleToggle(t.template_name, v)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Message Body</Label>
                        <Textarea
                          value={edit.message_body}
                          onChange={e => setEdits(prev => ({
                            ...prev,
                            [t.template_name]: { ...prev[t.template_name], message_body: e.target.value }
                          }))}
                          rows={3}
                          className="text-sm mt-1"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Timing Offset (hours)</Label>
                          <Input
                            type="number"
                            value={edit.timing_offset_hours}
                            onChange={e => setEdits(prev => ({
                              ...prev,
                              [t.template_name]: { ...prev[t.template_name], timing_offset_hours: parseInt(e.target.value) || 0 }
                            }))}
                            className="mt-1"
                          />
                        </div>
                        <Button size="sm" onClick={() => handleSave(t.template_name)}>
                          <Save className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Log Summary */}
      <WhatsAppLogSummary clinicId={clinicId} />
    </div>
  );
}

function WhatsAppLogSummary({ clinicId }: { clinicId: string }) {
  const { data: logs } = useQuery({
    queryKey: ["whatsapp-logs-recent", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_logs")
        .select("id, template_name, phone, status, sent_at, error_message")
        .eq("clinic_id", clinicId)
        .order("sent_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  if (!logs?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent Automation Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs border-b pb-1.5">
              <div>
                <span className="font-medium">{TEMPLATE_LABELS[l.template_name] || l.template_name}</span>
                <span className="text-muted-foreground ml-2">{l.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={l.status === "sent" ? "default" : l.status === "simulated" ? "secondary" : "destructive"} className="text-[10px]">
                  {l.status}
                </Badge>
                <span className="text-muted-foreground">{new Date(l.sent_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
