import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Settings2 } from "lucide-react";

type Row = { key: string; value: any; description: string | null };

export default function GlobalSettingsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => ((await supabase.from("platform_settings" as any).select("*").order("key")).data as Row[]) || [],
  });

  const [draft, setDraft] = useState<Record<string, any>>({});
  useEffect(() => {
    const init: Record<string, any> = {};
    rows.forEach((r) => (init[r.key] = r.value));
    setDraft(init);
  }, [rows]);

  const save = async (key: string) => {
    const { error } = await (supabase.from("platform_settings" as any) as any)
      .update({ value: draft[key], updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${key}`);
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>;

  const trial = rows.find((r) => r.key === "default_trial_days");
  const aiCap = rows.find((r) => r.key === "default_ai_cap_inr");
  const flags = rows.find((r) => r.key === "feature_flags");
  const supportEmail = rows.find((r) => r.key === "support_email");
  const supportWa = rows.find((r) => r.key === "support_whatsapp");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trial && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" />Default trial length</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Days</Label>
              <Input type="number" value={draft.default_trial_days ?? 30} onChange={(e) => setDraft({ ...draft, default_trial_days: Number(e.target.value) })} />
              <Button size="sm" onClick={() => save("default_trial_days")}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
              <p className="text-xs text-muted-foreground">Applied to clinics created from now on.</p>
            </CardContent>
          </Card>
        )}

        {aiCap && (
          <Card>
            <CardHeader><CardTitle className="text-base">Default AI cap (INR / month)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Amount</Label>
              <Input type="number" value={draft.default_ai_cap_inr ?? 500} onChange={(e) => setDraft({ ...draft, default_ai_cap_inr: Number(e.target.value) })} />
              <Button size="sm" onClick={() => save("default_ai_cap_inr")}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
            </CardContent>
          </Card>
        )}

        {supportEmail && (
          <Card>
            <CardHeader><CardTitle className="text-base">Support email</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={draft.support_email ?? ""} onChange={(e) => setDraft({ ...draft, support_email: e.target.value })} />
              <Button size="sm" onClick={() => save("support_email")}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
            </CardContent>
          </Card>
        )}

        {supportWa && (
          <Card>
            <CardHeader><CardTitle className="text-base">Support WhatsApp</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={draft.support_whatsapp ?? ""} onChange={(e) => setDraft({ ...draft, support_whatsapp: e.target.value })} />
              <Button size="sm" onClick={() => save("support_whatsapp")}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {flags && (
        <Card>
          <CardHeader><CardTitle className="text-base">Feature flags</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(draft.feature_flags || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="font-medium capitalize">{k.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">key: {k}</p>
                </div>
                <Switch checked={!!v} onCheckedChange={(c) => setDraft({ ...draft, feature_flags: { ...(draft.feature_flags || {}), [k]: c } })} />
              </div>
            ))}
            <Button size="sm" onClick={() => save("feature_flags")}><Save className="h-3.5 w-3.5 mr-1" />Save flags</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
