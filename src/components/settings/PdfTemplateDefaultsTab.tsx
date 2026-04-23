import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileText, Receipt, Palette } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_LIST, PDF_TEMPLATES, setClinicDefaults, type TemplateId,
} from "@/lib/pdf-templates";

const RX_KEY = "default_rx_template";
const INV_KEY = "default_invoice_template";

export default function PdfTemplateDefaultsTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [rxTpl, setRxTpl] = useState<TemplateId>("classic");
  const [invTpl, setInvTpl] = useState<TemplateId>("classic");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic-settings-pdf-templates", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("clinic_id", clinicId)
        .in("setting_key", [RX_KEY, INV_KEY]);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!settings) return;
    let rx: TemplateId = "classic";
    let inv: TemplateId = "classic";
    settings.forEach((s: any) => {
      if (s.setting_key === RX_KEY && PDF_TEMPLATES[s.setting_value as TemplateId]) {
        rx = s.setting_value;
      }
      if (s.setting_key === INV_KEY && PDF_TEMPLATES[s.setting_value as TemplateId]) {
        inv = s.setting_value;
      }
    });
    setRxTpl(rx);
    setInvTpl(inv);
    setClinicDefaults(rx, inv);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const items = [
        { key: RX_KEY, value: rxTpl },
        { key: INV_KEY, value: invTpl },
      ];
      for (const item of items) {
        const existing = settings?.find((s: any) => s.setting_key === item.key);
        if (existing) {
          const { error } = await supabase
            .from("clinic_settings")
            .update({ setting_value: item.value })
            .eq("id", (existing as any).id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("clinic_settings")
            .insert({ clinic_id: clinicId, setting_key: item.key, setting_value: item.value });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      setClinicDefaults(rxTpl, invTpl);
      queryClient.invalidateQueries({ queryKey: ["clinic-settings-pdf-templates"] });
      toast.success("Default templates saved for the whole clinic");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderPicker = (
    value: TemplateId,
    onChange: (v: TemplateId) => void,
    Icon: typeof FileText,
    label: string,
    description: string,
  ) => (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Icon className="h-5 w-5 text-primary" /> {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Template</Label>
          <Select value={value} onValueChange={(v) => onChange(v as TemplateId)}>
            <SelectTrigger>
              <Palette className="h-4 w-4 mr-2 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_LIST.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm border"
                      style={{ background: `rgb(${t.primary.join(",")})` }}
                    />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">— {t.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sample swatches */}
        <div className="grid grid-cols-5 gap-2">
          {TEMPLATE_LIST.map((t) => {
            const active = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`group relative rounded-md border p-2 text-left transition-all ${
                  active
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div
                  className="h-8 rounded-sm mb-1.5"
                  style={{ background: `rgb(${t.primary.join(",")})` }}
                />
                <div
                  className="h-2 rounded-sm mb-1"
                  style={{ background: `rgb(${t.accent.join(",")})` }}
                />
                <div className="text-[10px] font-medium leading-tight truncate">{t.name}</div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {renderPicker(
        rxTpl,
        setRxTpl,
        FileText,
        "Default Prescription Template",
        "Used for every prescription PDF in this clinic. Each user can still override on their own device.",
      )}
      {renderPicker(
        invTpl,
        setInvTpl,
        Receipt,
        "Default Invoice / Receipt Template",
        "Used for every invoice and receipt PDF in this clinic. Each user can still override on their own device.",
      )}

      <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
        <Save className="mr-2 h-4 w-4" />
        {save.isPending ? "Saving…" : "Save Clinic Defaults"}
      </Button>
    </div>
  );
}
