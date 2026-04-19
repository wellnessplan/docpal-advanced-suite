import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Palette, Save, Plus, Trash2, Link2, ExternalLink, Eye } from "lucide-react";

interface ActionLink {
  label: string;
  url: string;
  color: string;
}

interface RegSettings {
  welcome_heading: string;
  welcome_subheading: string;
  banner_image_url: string | null;
  brand_color: string;
  thank_you_heading: string;
  thank_you_message: string;
  show_logo: boolean;
  action_links: ActionLink[];
}

const DEFAULTS: RegSettings = {
  welcome_heading: "Patient Registration",
  welcome_subheading: "Fill in your details to get a queue token",
  banner_image_url: null,
  brand_color: "#2563eb",
  thank_you_heading: "Registration Successful!",
  thank_you_message: "Thank you for registering. Please wait for your token to be called.",
  show_logo: true,
  action_links: [],
};

export default function RegistrationPageBuilderTab({ clinicId }: { clinicId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RegSettings>(DEFAULTS);

  const { data } = useQuery({
    queryKey: ["clinic-reg-settings", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clinic_registration_settings")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (data) {
      setForm({
        welcome_heading: data.welcome_heading ?? DEFAULTS.welcome_heading,
        welcome_subheading: data.welcome_subheading ?? DEFAULTS.welcome_subheading,
        banner_image_url: data.banner_image_url,
        brand_color: data.brand_color ?? DEFAULTS.brand_color,
        thank_you_heading: data.thank_you_heading ?? DEFAULTS.thank_you_heading,
        thank_you_message: data.thank_you_message ?? DEFAULTS.thank_you_message,
        show_logo: data.show_logo ?? true,
        action_links: Array.isArray(data.action_links) ? data.action_links : [],
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { clinic_id: clinicId, ...form };
      const { error } = await (supabase as any)
        .from("clinic_registration_settings")
        .upsert(payload, { onConflict: "clinic_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-reg-settings"] });
      toast.success("Registration page saved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addLink = () =>
    setForm((f) => ({ ...f, action_links: [...f.action_links, { label: "", url: "", color: form.brand_color }] }));

  const updateLink = (i: number, patch: Partial<ActionLink>) =>
    setForm((f) => ({ ...f, action_links: f.action_links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const removeLink = (i: number) =>
    setForm((f) => ({ ...f, action_links: f.action_links.filter((_, j) => j !== i) }));

  const previewUrl = `${window.location.origin}/register?clinic=${clinicId}`;

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Palette className="h-5 w-5 text-primary" /> QR Registration Page Builder
          </CardTitle>
          <CardDescription>
            Customize how patients see your QR registration page and the success screen they get after booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Welcome */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Welcome Heading</Label>
              <Input value={form.welcome_heading} onChange={(e) => setForm({ ...form, welcome_heading: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sub-heading</Label>
              <Input value={form.welcome_subheading} onChange={(e) => setForm({ ...form, welcome_subheading: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Banner Image URL (optional)</Label>
              <Input
                placeholder="https://… (shown above the form)"
                value={form.banner_image_url ?? ""}
                onChange={(e) => setForm({ ...form, banner_image_url: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="h-9 w-12 rounded cursor-pointer border"
                />
                <Input value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={form.show_logo} onCheckedChange={(v) => setForm({ ...form, show_logo: v })} />
            <div>
              <p className="text-sm font-semibold">Show clinic logo</p>
              <p className="text-xs text-muted-foreground">Display your uploaded clinic logo at the top of the registration page</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="text-base">Token / Thank-You Screen</CardTitle>
          <CardDescription>What patients see after they finish registering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Heading</Label>
            <Input value={form.thank_you_heading} onChange={(e) => setForm({ ...form, thank_you_heading: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea rows={3} value={form.thank_you_message} onChange={(e) => setForm({ ...form, thank_you_message: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Action Buttons / Links</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLink}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Add buttons shown on the success screen — e.g. "Play a Game", "Take Our Survey", "Visit Our Website".
            </p>
            <div className="space-y-2">
              {form.action_links.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No links yet. Click "Add link" to create one.</p>
              )}
              {form.action_links.map((link, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-lg border p-2 bg-muted/30">
                  <Input
                    placeholder="Button label"
                    className="col-span-3 h-9 text-sm"
                    value={link.label}
                    onChange={(e) => updateLink(i, { label: e.target.value })}
                  />
                  <Input
                    placeholder="https://…"
                    className="col-span-7 h-9 text-sm font-mono"
                    value={link.url}
                    onChange={(e) => updateLink(i, { url: e.target.value })}
                  />
                  <input
                    type="color"
                    value={link.color}
                    onChange={(e) => updateLink(i, { color: e.target.value })}
                    className="col-span-1 h-9 w-full rounded cursor-pointer border"
                  />
                  <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => removeLink(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Saving…" : "Save Registration Page"}
        </Button>
        <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}>
          <Eye className="mr-2 h-4 w-4" /> Preview
        </Button>
        <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> {previewUrl}
        </a>
      </div>
    </div>
  );
}
