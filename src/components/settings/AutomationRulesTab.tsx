import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquareText, AlarmClock, Pill, Star, Save } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  clinic_id: string;
  rule_key: string;
  enabled: boolean;
  days_offset: number;
  default_duration_days: number;
  video_url: string | null;
  cta_link: string | null;
  message_body: string;
}

const RULE_META: Record<string, { title: string; desc: string; icon: any; placeholders: string[]; showDays: boolean; showDuration: boolean; daysLabel?: string; ctaLabel?: string }> = {
  post_treatment_instant: {
    title: "Instant Rx + Post-op (after treatment)",
    desc: "Fires the moment a treatment is marked 'completed'. Sends prescription link + post-op care video.",
    icon: MessageSquareText,
    placeholders: ["{{patient_name}}", "{{treatment}}", "{{rx_link}}", "{{video_url}}", "{{clinic_name}}"],
    showDays: false, showDuration: false,
    ctaLabel: "Prescription portal link (used as {{rx_link}})",
  },
  treatment_not_accepted: {
    title: "Treatment-not-accepted reminder",
    desc: "If a planned treatment isn't accepted within X days, sends a reminder with optional video.",
    icon: AlarmClock,
    placeholders: ["{{patient_name}}", "{{treatment}}", "{{video_url}}", "{{clinic_name}}"],
    showDays: true, showDuration: false,
    daysLabel: "Days after planning to send reminder",
  },
  daily_medicine_reminder: {
    title: "Daily medicine reminder",
    desc: "Sends a daily nudge during the prescription duration. Uses Rx duration if available, else the default.",
    icon: Pill,
    placeholders: ["{{patient_name}}", "{{day}}", "{{total_days}}", "{{video_url}}", "{{clinic_name}}"],
    showDays: false, showDuration: true,
  },
  post_med_review_referral: {
    title: "Review + Referral request",
    desc: "Fires X days after the medicine course ends. Asks for a Google review and refer-a-friend.",
    icon: Star,
    placeholders: ["{{patient_name}}", "{{review_link}}", "{{clinic_name}}"],
    showDays: true, showDuration: true,
    daysLabel: "Days after medicine course ends",
    ctaLabel: "Review / referral link (used as {{review_link}})",
  },
};

const RULE_ORDER = ["post_treatment_instant", "treatment_not_accepted", "daily_medicine_reminder", "post_med_review_referral"];

export default function AutomationRulesTab({ clinicId }: { clinicId: string }) {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("clinic_id", clinicId);
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Bot className="h-5 w-5 text-primary" /> WhatsApp Automation Rules
          </CardTitle>
          <CardDescription>
            Customize timing, video clips, and message text for each automated WhatsApp trigger. Use placeholders inside <code className="text-xs bg-background px-1 rounded">{"{{double_braces}}"}</code> — they get replaced when the message is sent.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Loading rules…</p>}
      {RULE_ORDER.map(key => {
        const rule = rules.find(r => r.rule_key === key);
        if (!rule) return null;
        return <RuleCard key={rule.id} rule={rule} onSaved={() => qc.invalidateQueries({ queryKey: ["automation-rules", clinicId] })} />;
      })}
    </div>
  );
}

function RuleCard({ rule, onSaved }: { rule: Rule; onSaved: () => void }) {
  const meta = RULE_META[rule.rule_key];
  const Icon = meta?.icon ?? Bot;
  const [form, setForm] = useState({
    enabled: rule.enabled,
    days_offset: rule.days_offset,
    default_duration_days: rule.default_duration_days,
    video_url: rule.video_url ?? "",
    cta_link: rule.cta_link ?? "",
    message_body: rule.message_body ?? "",
  });

  useEffect(() => {
    setForm({
      enabled: rule.enabled,
      days_offset: rule.days_offset,
      default_duration_days: rule.default_duration_days,
      video_url: rule.video_url ?? "",
      cta_link: rule.cta_link ?? "",
      message_body: rule.message_body ?? "",
    });
  }, [rule.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("automation_rules")
        .update({
          enabled: form.enabled,
          days_offset: form.days_offset,
          default_duration_days: form.default_duration_days,
          video_url: form.video_url || null,
          cta_link: form.cta_link || null,
          message_body: form.message_body,
        })
        .eq("id", rule.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rule saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-heading text-base">{meta?.title ?? rule.rule_key}</CardTitle>
              <CardDescription className="text-xs mt-1">{meta?.desc}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={form.enabled ? "default" : "secondary"} className="text-[10px]">
              {form.enabled ? "ON" : "OFF"}
            </Badge>
            <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meta?.showDays && (
            <div>
              <Label className="text-xs">{meta.daysLabel ?? "Days offset"}</Label>
              <Input
                type="number" min={0}
                value={form.days_offset}
                onChange={e => setForm(f => ({ ...f, days_offset: Number(e.target.value) || 0 }))}
              />
            </div>
          )}
          {meta?.showDuration && (
            <div>
              <Label className="text-xs">Default medicine duration (days)</Label>
              <Input
                type="number" min={1}
                value={form.default_duration_days}
                onChange={e => setForm(f => ({ ...f, default_duration_days: Number(e.target.value) || 1 }))}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Used when prescription doesn't specify a duration.</p>
            </div>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs">Video URL (optional, used as {"{{video_url}}"})</Label>
            <Input
              placeholder="https://youtu.be/your-care-video"
              value={form.video_url}
              onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
            />
          </div>
          {meta?.ctaLabel && (
            <div className="md:col-span-2">
              <Label className="text-xs">{meta.ctaLabel}</Label>
              <Input
                placeholder="https://g.page/your-clinic/review"
                value={form.cta_link}
                onChange={e => setForm(f => ({ ...f, cta_link: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs">Message body</Label>
          <Textarea
            rows={4}
            value={form.message_body}
            onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {meta?.placeholders.map(ph => (
              <button
                key={ph} type="button"
                onClick={() => setForm(f => ({ ...f, message_body: f.message_body + " " + ph }))}
                className="text-[10px] bg-muted hover:bg-accent px-2 py-0.5 rounded font-mono"
              >
                {ph}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" /> {save.isPending ? "Saving…" : "Save rule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
