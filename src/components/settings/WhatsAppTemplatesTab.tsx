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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, Save, RotateCcw, Plus, Trash2, Search } from "lucide-react";

const DEFAULT_TEMPLATES = [
  // Recall & Retention
  { template_name: "recall_6month", template_type: "recall", timing_offset_hours: 4320,
    message_body: "Hi {{patient_name}} 👋\n\nIt's been 6 months since your last visit at *{{clinic_name}}*! 🦷\n\nRegular dental check-ups catch small problems before they become big (and expensive) ones.\n\nBook your check-up now 👉 {{booking_link}}\n\nSee you soon!\n— Dr. {{doctor_name}}" },
  { template_name: "incomplete_treatment_followup", template_type: "followup", timing_offset_hours: 168,
    message_body: "Hi {{patient_name}} 😊\n\nWe noticed your *{{treatment}}* for tooth {{tooth_number}} is still pending at *{{clinic_name}}*.\n\nWe'd love to complete your treatment and get your smile back to 100%! 🌟\n\nShall we book your next appointment?\n👉 Reply YES or call {{clinic_phone}}\n\n— Dr. {{doctor_name}}" },
  { template_name: "brush_change_reminder", template_type: "reminder", timing_offset_hours: 2160,
    message_body: "Hi {{patient_name}} 🪥\n\nYou visited *{{clinic_name}}* for a cleaning 3 months ago — great news!\n\nTime for a quick reminder: *Change your toothbrush!* 🦷\nWorn bristles don't clean as effectively.\n\nPro tip: Soft bristles, 2 minutes, twice a day!\n\nAny sensitivity or concerns? Reply here — we're happy to help.\n\n— Team {{clinic_name}}" },

  // Festive / Seasonal
  { template_name: "diwali_whitening_offer", template_type: "festive", timing_offset_hours: 0,
    message_body: "✨ *Smile Brighter This Diwali!*\n\nThis festive season, gift yourself a confident, sparkling smile! 😁\n\nSpecial Diwali Offer at *{{clinic_name}}*:\n🎇 *20% OFF* Teeth Whitening\n📅 Valid: {{start_date}} – {{end_date}}\n\nBook your slot: {{booking_link}} or call {{clinic_phone}}\n\n*Limited slots — book early!*\n\n— Dr. {{doctor_name}} & Team" },
  { template_name: "new_year_fresh_start", template_type: "festive", timing_offset_hours: 0,
    message_body: "🎊 *Happy New Year from {{clinic_name}}!*\n\n*New Year. New Smile. New You.* 🦷✨\n\nMake dental health part of your resolutions!\n\n🎁 *January Special:* Complimentary fluoride treatment with any check-up booking.\n\nBook now 👉 {{booking_link}}\n\nWishing you a healthy, happy year ahead!\n— Dr. {{doctor_name}} & Team" },
  { template_name: "childrens_day_camp", template_type: "event", timing_offset_hours: 0,
    message_body: "👶 *Happy Children's Day!*\n\nSurprise your little ones with a *Fun Dental Camp!* 🦷🎈\n\nDate: {{event_date}}\nTime: {{event_time}}\nVenue: *{{clinic_name}}*\n\nIncludes:\n✅ Free dental check-up\n✅ Fluoride treatment\n✅ Tooth-brushing demo\n✅ Fun stickers & goodies!\n\nBook your child's slot: {{booking_link}}\n\n— Dr. {{doctor_name}}" },
  { template_name: "world_oral_health_day", template_type: "awareness", timing_offset_hours: 0,
    message_body: "🌍 *World Oral Health Day — March 20*\n\n*Your mouth is the gateway to your health.*\n\nDid you know? Poor oral health is linked to heart disease, diabetes, and more.\n\n3 habits for a healthy mouth:\n1️⃣ Brush twice daily (2 min each)\n2️⃣ Floss once a day\n3️⃣ Visit your dentist every 6 months\n\nBook your check-up at *{{clinic_name}}* today 👉 {{booking_link}}\n\n— Dr. {{doctor_name}}" },
  { template_name: "monsoon_special", template_type: "seasonal", timing_offset_hours: 0,
    message_body: "🌧️ *Monsoon Season Alert!*\n\nRains + street food + sweet cravings = more cavities! 😅\n\nDon't let the monsoon spoil your smile. A quick check-up can prevent bigger problems later.\n\n*{{clinic_name}}* is open all through the rains!\n\nBook your visit: {{booking_link}}\n\n*Stay dry. Stay smiling!* ☔😁\n— Dr. {{doctor_name}}" },

  // High-Value Treatment
  { template_name: "implant_awareness", template_type: "treatment", timing_offset_hours: 0,
    message_body: "🦷 *Missing a tooth? Don't let it affect your confidence.*\n\nDental implants are the *gold standard* for tooth replacement — they look, feel, and work like natural teeth.\n\n✅ Lifetime solution\n✅ No impact on adjacent teeth\n✅ Eat anything you love\n\nConsultation at *{{clinic_name}}*: FREE this month.\n\nBook your consult: {{booking_link}} | Call: {{clinic_phone}}\n\n— Dr. {{doctor_name}}" },
  { template_name: "smile_makeover_veneers", template_type: "treatment", timing_offset_hours: 0,
    message_body: "✨ *Your Dream Smile is Closer Than You Think.*\n\nVeneers can transform your smile in just 2 visits.\n\n🌟 Cover chips, stains, gaps & uneven teeth\n🌟 Natural-looking, long-lasting\n🌟 Minimal tooth reduction\n\nBook a *FREE Smile Consultation* at *{{clinic_name}}*\n\n📞 {{clinic_phone}} | 🔗 {{booking_link}}\n\n— Dr. {{doctor_name}}" },
  { template_name: "orthodontic_braces_awareness", template_type: "treatment", timing_offset_hours: 0,
    message_body: "😁 *Straighten Your Teeth Without Anyone Knowing!*\n\nClear aligners at *{{clinic_name}}* — as comfortable as wearing a retainer.\n\n✅ Removable — eat & drink freely\n✅ Nearly invisible\n✅ Predictable results with digital planning\n✅ EMI options available\n\nFREE orthodontic consultation this month.\n\nBook now: {{booking_link}}\n\n— Dr. {{doctor_name}}" },

  // Reviews & Referrals
  { template_name: "google_review_request", template_type: "review", timing_offset_hours: 2,
    message_body: "Hi {{patient_name}} 😊\n\nThank you for visiting *{{clinic_name}}* today! We hope your experience was comfortable.\n\nIf you have 30 seconds, your Google review means the world to us and helps other patients find trusted dental care:\n\n⭐⭐⭐⭐⭐ {{google_review_link}}\n\nThank you so much!\n— Dr. {{doctor_name}} & Team" },
  { template_name: "refer_a_friend", template_type: "referral", timing_offset_hours: 0,
    message_body: "Hi {{patient_name}}! 👋\n\nWe love having you as a patient at *{{clinic_name}}!* 💙\n\nKnow someone who needs dental care? *Refer a friend* and both of you get:\n\n🎁 *You: Rs 500 credit on your next visit*\n🎁 *Your friend: FREE first check-up*\n\nShare your referral link: {{referral_link}}\n\nThank you for spreading the smile! 😁\n— Dr. {{doctor_name}}" },

  // Existing operational templates
  { template_name: "appt_reminder_24h", template_type: "reminder", timing_offset_hours: 24,
    message_body: "Hi {{patient_name}}, this is a reminder for your dental appointment tomorrow ({{date}}) at {{time}}. Please be on time. — {{clinic_name}}" },
  { template_name: "post_treatment_followup", template_type: "followup", timing_offset_hours: 72,
    message_body: "Hi {{patient_name}}, we hope you're recovering well after your {{treatment}}. Please follow the post-care instructions. Contact us if you have any concerns. — {{clinic_name}}" },
  { template_name: "payment_due_reminder", template_type: "payment", timing_offset_hours: 48,
    message_body: "Hi {{patient_name}}, your payment of Rs {{amount}} is due on {{due_date}}. Please make the payment at your earliest convenience. — {{clinic_name}}" },
  { template_name: "birthday_greeting", template_type: "greeting", timing_offset_hours: 0,
    message_body: "Happy Birthday {{patient_name}}! 🎂🎉\n\nWishing you a wonderful year filled with healthy smiles!\n\n— Dr. {{doctor_name}} & Team {{clinic_name}}" },
];

const TEMPLATE_TYPE_OPTIONS = [
  "reminder", "followup", "recall", "festive", "seasonal", "event",
  "awareness", "treatment", "review", "referral", "payment", "greeting", "custom",
];

const TYPE_COLORS: Record<string, string> = {
  recall: "bg-blue-500/10 text-blue-600",
  reminder: "bg-amber-500/10 text-amber-600",
  followup: "bg-teal-500/10 text-teal-600",
  festive: "bg-pink-500/10 text-pink-600",
  seasonal: "bg-cyan-500/10 text-cyan-600",
  event: "bg-purple-500/10 text-purple-600",
  awareness: "bg-green-500/10 text-green-600",
  treatment: "bg-indigo-500/10 text-indigo-600",
  review: "bg-yellow-500/10 text-yellow-700",
  referral: "bg-rose-500/10 text-rose-600",
  payment: "bg-red-500/10 text-red-600",
  greeting: "bg-emerald-500/10 text-emerald-600",
  custom: "bg-gray-500/10 text-gray-600",
};

export default function WhatsAppTemplatesTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [wabaToken, setWabaToken] = useState("");
  const [wabaPhoneId, setWabaPhoneId] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ template_name: "", template_type: "custom", message_body: "", timing_offset_hours: 0 });

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
        .from("whatsapp_templates").select("*").eq("clinic_id", clinicId).order("created_at");
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
        map[t.template_name] = { message_body: t.message_body, enabled: t.enabled, timing_offset_hours: t.timing_offset_hours };
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
      toast.success("All templates loaded!");
    },
    onError: () => toast.error("Failed to load defaults"),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ templateName, data }: { templateName: string; data: any }) => {
      const { error } = await supabase.from("whatsapp_templates").update(data).eq("clinic_id", clinicId).eq("template_name", templateName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template updated!");
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateName: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("clinic_id", clinicId).eq("template_name", templateName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const addTemplate = useMutation({
    mutationFn: async () => {
      if (!newTemplate.template_name || !newTemplate.message_body) throw new Error("Name and message required");
      const slug = newTemplate.template_name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const { error } = await supabase.from("whatsapp_templates").insert({
        clinic_id: clinicId,
        template_name: slug,
        template_type: newTemplate.template_type,
        message_body: newTemplate.message_body,
        timing_offset_hours: newTemplate.timing_offset_hours,
        enabled: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setShowAddDialog(false);
      setNewTemplate({ template_name: "", template_type: "custom", message_body: "", timing_offset_hours: 0 });
      toast.success("Template added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleToggle = (name: string, enabled: boolean) => {
    setEdits(prev => ({ ...prev, [name]: { ...prev[name], enabled } }));
    updateTemplate.mutate({ templateName: name, data: { enabled } });
  };

  const handleSave = (name: string) => {
    const edit = edits[name];
    if (!edit) return;
    updateTemplate.mutate({ templateName: name, data: { message_body: edit.message_body, timing_offset_hours: edit.timing_offset_hours } });
  };

  const formatName = (name: string) => name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const filteredTemplates = (templates ?? []).filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.template_name.includes(q) || t.message_body.toLowerCase().includes(q) || t.template_type.toLowerCase().includes(q);
    const matchesType = filterType === "all" || t.template_type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) return <div className="text-muted-foreground p-4">Loading templates...</div>;

  const hasTemplates = templates && templates.length > 0;

  return (
    <div className="space-y-4">
      {/* WABA Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" /> WhatsApp Business API Credentials
          </CardTitle>
          <CardDescription>Enter your WABA token and Phone Number ID. Without these, messages will be simulated only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">API Token</Label>
              <Input type="password" value={wabaToken} onChange={e => setWabaToken(e.target.value)} placeholder="EAAxxxxxxx..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone Number ID</Label>
              <Input value={wabaPhoneId} onChange={e => setWabaPhoneId(e.target.value)} placeholder="1234567890" />
            </div>
          </div>
          <Button size="sm" onClick={saveCredentials} disabled={savingCreds}>
            <Save className="h-3.5 w-3.5 mr-1" /> {savingCreds ? "Saving..." : "Save Credentials"}
          </Button>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Campaign & Automation Templates
              </CardTitle>
              <CardDescription className="mt-1">
                Placeholders: {"{{patient_name}}"}, {"{{clinic_name}}"}, {"{{doctor_name}}"}, {"{{date}}"}, {"{{time}}"}, {"{{treatment}}"}, {"{{amount}}"}, {"{{booking_link}}"}, {"{{clinic_phone}}"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {hasTemplates && (
                <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Template
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasTemplates ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">No templates configured yet.</p>
              <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" /> Load All {DEFAULT_TEMPLATES.length} Templates
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {TEMPLATE_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground">{filteredTemplates.length} of {templates.length} templates</div>

              {filteredTemplates.map(t => {
                const edit = edits[t.template_name];
                if (!edit) return null;
                return (
                  <Card key={t.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{formatName(t.template_name)}</h4>
                          <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[t.template_type] || ""}`}>
                            {t.template_type}
                          </Badge>
                          <Badge variant={edit.enabled ? "default" : "secondary"} className="text-[10px]">
                            {edit.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={edit.enabled} onCheckedChange={(v) => handleToggle(t.template_name, v)} />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate(t.template_name); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Message Body</Label>
                        <Textarea
                          value={edit.message_body}
                          onChange={e => setEdits(prev => ({ ...prev, [t.template_name]: { ...prev[t.template_name], message_body: e.target.value } }))}
                          rows={4} className="text-sm mt-1 font-mono"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-48">
                          <Label className="text-xs text-muted-foreground">Timing Offset (hours)</Label>
                          <Input type="number" value={edit.timing_offset_hours}
                            onChange={e => setEdits(prev => ({ ...prev, [t.template_name]: { ...prev[t.template_name], timing_offset_hours: parseInt(e.target.value) || 0 } }))}
                            className="mt-1 h-8" />
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

      {/* Add Template Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Template Name</Label>
              <Input placeholder="e.g. Eid Greeting" value={newTemplate.template_name}
                onChange={e => setNewTemplate(p => ({ ...p, template_name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newTemplate.template_type} onValueChange={v => setNewTemplate(p => ({ ...p, template_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Message Body</Label>
              <Textarea placeholder="Hi {{patient_name}}..." rows={5} value={newTemplate.message_body}
                onChange={e => setNewTemplate(p => ({ ...p, message_body: e.target.value }))} className="mt-1 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Timing Offset (hours)</Label>
              <Input type="number" value={newTemplate.timing_offset_hours}
                onChange={e => setNewTemplate(p => ({ ...p, timing_offset_hours: parseInt(e.target.value) || 0 }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={() => addTemplate.mutate()} disabled={addTemplate.isPending || !newTemplate.template_name || !newTemplate.message_body}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Log */}
      <WhatsAppLogSummary clinicId={clinicId} />
    </div>
  );
}

function WhatsAppLogSummary({ clinicId }: { clinicId: string }) {
  const { data: logs } = useQuery({
    queryKey: ["whatsapp-logs-recent", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_logs")
        .select("id, template_name, phone, status, sent_at, error_message")
        .eq("clinic_id", clinicId).order("sent_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  if (!logs?.length) return null;

  const formatName = (name: string) => name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Recent Automation Log</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs border-b pb-1.5">
              <div>
                <span className="font-medium">{formatName(l.template_name)}</span>
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
