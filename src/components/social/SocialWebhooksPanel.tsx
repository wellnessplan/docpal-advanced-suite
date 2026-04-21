import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

const PLATFORMS = ["Facebook", "Instagram", "Twitter", "LinkedIn"];

export function SocialWebhooksPanel({ clinicId }: { clinicId: string }) {
  const [hooks, setHooks] = useState<Record<string, { url: string; enabled: boolean; id?: string }>>({});

  const load = async () => {
    const { data } = await supabase.from("social_webhooks").select("*").eq("clinic_id", clinicId);
    const map: any = {};
    PLATFORMS.forEach(p => { map[p] = { url: "", enabled: true }; });
    (data ?? []).forEach((h: any) => { map[h.platform] = { url: h.webhook_url, enabled: h.enabled, id: h.id }; });
    setHooks(map);
  };

  useEffect(() => { load(); }, [clinicId]);

  const save = async (platform: string) => {
    const h = hooks[platform];
    if (!h.url.trim()) { toast.error("URL required"); return; }
    const existing = h.id;
    if (existing) {
      const { error } = await supabase.from("social_webhooks").update({
        webhook_url: h.url, enabled: h.enabled,
      }).eq("id", existing);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("social_webhooks").insert({
        clinic_id: clinicId, platform, webhook_url: h.url, enabled: h.enabled,
      });
      if (error) return toast.error(error.message);
    }
    toast.success(`${platform} webhook saved`);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform webhooks (Zapier / Make / n8n)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Each platform fires the configured webhook with the post payload. Wire your Zap/scenario to actually post to the platform.
        </p>
        {PLATFORMS.map(p => (
          <div key={p} className="grid grid-cols-[100px_1fr_auto_auto] gap-2 items-center">
            <Label>{p}</Label>
            <Input
              placeholder={`https://hooks.zapier.com/... for ${p}`}
              value={hooks[p]?.url || ""}
              onChange={e => setHooks(h => ({ ...h, [p]: { ...h[p], url: e.target.value } }))}
            />
            <Switch
              checked={hooks[p]?.enabled ?? true}
              onCheckedChange={(v) => setHooks(h => ({ ...h, [p]: { ...h[p], enabled: v } }))}
            />
            <Button size="sm" onClick={() => save(p)}><Save className="w-4 h-4" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
