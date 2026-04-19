import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Globe, MapPin, Phone, Mail, Link2, Facebook, Instagram, Twitter,
  Users, Plus, Trash2, Save, Package, Settings as SettingsIcon, QrCode, Plug,
  Clock, Receipt, UserPlus, Download, Printer, Copy, ExternalLink, Truck
} from "lucide-react";
import GoogleIntegrationTab from "@/components/settings/GoogleIntegrationTab";
import WhatsAppTemplatesTab from "@/components/settings/WhatsAppTemplatesTab";
import WebhooksTab from "@/components/settings/WebhooksTab";
import ThemeBrandingTab from "@/components/settings/ThemeBrandingTab";
import DataImportTab from "@/components/settings/DataImportTab";
import DiscountCouponsTab from "@/components/settings/DiscountCouponsTab";
import SubscriptionPlanTab from "@/components/settings/SubscriptionPlanTab";
import WorkingHoursPerDayTab from "@/components/settings/WorkingHoursPerDayTab";
import RegistrationPageBuilderTab from "@/components/settings/RegistrationPageBuilderTab";
import { QRCodeSVG } from "qrcode.react";

// ─── Clinic Info Tab ────────────────────────────────────────────────
function ClinicInfoTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", address: "", phone: "", email: "", website: "",
    logo_url: "", google_maps_url: "", facebook_url: "", instagram_url: "",
    twitter_url: "", tiktok_url: "",
  });

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("*").eq("id", clinicId).single();
      return data;
    },
  });

  useEffect(() => {
    if (clinic) {
      const c = clinic as any;
      setForm({
        name: c.name || "", address: c.address || "", phone: c.phone || "",
        email: c.email || "", website: c.website || "", logo_url: c.logo_url || "",
        google_maps_url: c.google_maps_url || "", facebook_url: c.facebook_url || "",
        instagram_url: c.instagram_url || "", twitter_url: c.twitter_url || "",
        tiktok_url: c.tiktok_url || "",
      });
    }
  }, [clinic]);

  const updateClinic = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("clinics") as any).update(form).eq("id", clinicId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clinic"] }); toast.success("Clinic info updated!"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <form onSubmit={e => { e.preventDefault(); updateClinic.mutate(); }} className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Building2 className="h-5 w-5 text-primary" /> Basic Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Clinic Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="hello@clinic.com" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 123-4567" /></div>
            <div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://yourpractice.com" /></div>
          </div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City, State" /></div>
          <div className="space-y-2"><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." /></div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg"><Link2 className="h-5 w-5 text-primary" /> Social & GMB Links</CardTitle>
          <CardDescription>Connect your online presence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Google Business Profile URL</Label>
            <Input value={form.google_maps_url} onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))} placeholder="https://g.page/your-clinic" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label className="flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook</Label><Input value={form.facebook_url} onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</Label><Input value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label className="flex items-center gap-2"><Twitter className="h-4 w-4" /> Twitter / X</Label><Input value={form.twitter_url} onChange={e => setForm(f => ({ ...f, twitter_url: e.target.value }))} /></div>
            <div className="space-y-2"><Label>TikTok</Label><Input value={form.tiktok_url} onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={updateClinic.isPending}><Save className="mr-2 h-4 w-4" />{updateClinic.isPending ? "Saving..." : "Save Changes"}</Button>
    </form>
  );
}

// ─── Working Hours Tab ──────────────────────────────────────────────
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function WorkingHoursTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(
    DAYS.map(d => ({ day: d, open: d !== "Sunday", from: "09:00", to: "18:00" }))
  );

  const { data: settings } = useQuery({
    queryKey: ["clinic-settings-hours", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_settings").select("*").eq("clinic_id", clinicId).eq("setting_key", "working_hours").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings?.setting_value) {
      try { setHours(JSON.parse(settings.setting_value)); } catch {}
    }
  }, [settings]);

  const saveHours = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(hours);
      if (settings) {
        const { error } = await supabase.from("clinic_settings").update({ setting_value: value }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_settings").insert({ clinic_id: clinicId, setting_key: "working_hours", setting_value: value });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clinic-settings-hours"] }); toast.success("Working hours saved!"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><Clock className="h-5 w-5 text-primary" /> Working Hours</CardTitle>
        <CardDescription>Set your clinic's operating schedule</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours.map((h, i) => (
          <div key={h.day} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-28 cursor-pointer">
              <input type="checkbox" checked={h.open} onChange={() => setHours(prev => prev.map((x, j) => j === i ? { ...x, open: !x.open } : x))}
                className="rounded border-border text-primary focus:ring-primary" />
              <span className={`text-sm ${h.open ? "text-foreground" : "text-muted-foreground line-through"}`}>{h.day}</span>
            </label>
            {h.open && (
              <div className="flex items-center gap-2 flex-1">
                <Input type="time" value={h.from} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} className="h-8 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={h.to} onChange={e => setHours(prev => prev.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} className="h-8 text-xs" />
              </div>
            )}
          </div>
        ))}
        <Button onClick={() => saveHours.mutate()} disabled={saveHours.isPending} className="mt-4">
          <Save className="mr-2 h-4 w-4" />{saveHours.isPending ? "Saving..." : "Save Hours"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Billing & GST Tab ──────────────────────────────────────────────
function BillingTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [gstNumber, setGstNumber] = useState("");
  const [taxRate, setTaxRate] = useState("18");
  const [currency, setCurrency] = useState("INR");

  const { data: settings } = useQuery({
    queryKey: ["clinic-settings-billing", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_settings").select("*").eq("clinic_id", clinicId).in("setting_key", ["gst_number", "default_tax_rate", "currency"]);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settings) {
      settings.forEach((s: any) => {
        if (s.setting_key === "gst_number") setGstNumber(s.setting_value || "");
        if (s.setting_key === "default_tax_rate") setTaxRate(s.setting_value || "18");
        if (s.setting_key === "currency") setCurrency(s.setting_value || "INR");
      });
    }
  }, [settings]);

  const saveBilling = useMutation({
    mutationFn: async () => {
      const items = [
        { key: "gst_number", value: gstNumber },
        { key: "default_tax_rate", value: taxRate },
        { key: "currency", value: currency },
      ];
      for (const item of items) {
        const existing = settings?.find((s: any) => s.setting_key === item.key);
        if (existing) {
          await supabase.from("clinic_settings").update({ setting_value: item.value }).eq("id", (existing as any).id);
        } else {
          await supabase.from("clinic_settings").insert({ clinic_id: clinicId, setting_key: item.key, setting_value: item.value });
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clinic-settings-billing"] }); toast.success("Billing settings saved!"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><Receipt className="h-5 w-5 text-primary" /> Billing & GST</CardTitle>
        <CardDescription>Configure billing defaults for invoices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>GST / Tax ID Number</Label><Input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Default Tax Rate (%)</Label><Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="18" /></div>
          <div className="space-y-2"><Label>Currency</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="INR" /></div>
        </div>
        <Button onClick={() => saveBilling.mutate()} disabled={saveBilling.isPending}>
          <Save className="mr-2 h-4 w-4" />{saveBilling.isPending ? "Saving..." : "Save Billing Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Invite Staff Tab (with role selection + shareable links) ──────
function InviteStaffTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [invites, setInvites] = useState<{ email: string; role: string; name: string }[]>([
    { email: "", role: "receptionist", name: "" },
  ]);
  const [sending, setSending] = useState(false);

  // Fetch all pending invitations so links are always available
  const { data: pending } = useQuery({
    queryKey: ["staff-invitations", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("staff_invitations")
        .select("id, email, full_name, role, status, invite_token, expires_at, created_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const addRow = () => setInvites(prev => [...prev, { email: "", role: "receptionist", name: "" }]);
  const removeRow = (i: number) => setInvites(prev => prev.filter((_, j) => j !== i));
  const updateRow = (i: number, field: string, val: string) =>
    setInvites(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r));

  const buildInviteLink = (token: string) => `${window.location.origin}/accept-invite/${token}`;

  const copyLink = (token: string) => {
    const url = buildInviteLink(token);
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard!");
  };

  const shareWhatsApp = (token: string, name?: string | null) => {
    const url = buildInviteLink(token);
    const msg = encodeURIComponent(
      `Hi${name ? " " + name : ""}! You've been invited to join our clinic on DoctorsBuddy. Click this link to accept and create your account: ${url}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const revokeInvite = async (id: string) => {
    const { error } = await (supabase as any).from("staff_invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invitation revoked");
    queryClient.invalidateQueries({ queryKey: ["staff-invitations"] });
  };

  const handleInvite = async () => {
    const valid = invites.filter(r => r.email.trim() && r.email.includes("@"));
    if (!valid.length) { toast.error("Enter at least one valid email"); return; }
    setSending(true);

    try {
      const rows = valid.map(inv => ({
        clinic_id: clinicId,
        email: inv.email.trim().toLowerCase(),
        full_name: inv.name || inv.email.split("@")[0],
        role: inv.role,
        status: "pending",
      }));

      const { error } = await (supabase as any).from("staff_invitations").insert(rows);
      if (error) throw error;

      await supabase.from("audit_log").insert(
        valid.map(inv => ({
          clinic_id: clinicId,
          action: "staff_invited",
          table_name: "staff_invitations",
          details: { email: inv.email, role: inv.role, name: inv.name },
        })) as any
      );

      toast.success(`${valid.length} invite(s) created. Copy the link below and share via WhatsApp/email.`);
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["staff-invitations"] });
      setInvites([{ email: "", role: "receptionist", name: "" }]);
    } catch (e: any) {
      toast.error(e.message || "Failed to create invitations");
    } finally {
      setSending(false);
    }
  };

  const pendingOnly = (pending ?? []).filter((p: any) => p.status === "pending");

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg"><UserPlus className="h-5 w-5 text-primary" /> Invite Staff</CardTitle>
          <CardDescription>
            Generate a secure signup link for each team member. Share it via WhatsApp, email, or any messaging app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invites.map((inv, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_180px_40px] items-end border-b border-border pb-3 last:border-0">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={inv.name} onChange={e => updateRow(i, "name", e.target.value)} placeholder="Dr. John" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input value={inv.email} onChange={e => updateRow(i, "email", e.target.value)} placeholder="staff@clinic.com" type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={inv.role} onValueChange={v => updateRow(i, "role", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["owner", "doctor", "dentist", "hygienist", "receptionist", "assistant"].map(r =>
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {invites.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRow(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Another
            </Button>
            <Button onClick={handleInvite} disabled={sending} className="gap-1.5">
              <UserPlus className="h-4 w-4" />{sending ? "Creating..." : "Generate Invite Links"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations with shareable links */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Link2 className="h-5 w-5 text-primary" /> Pending Invitations
          </CardTitle>
          <CardDescription>
            Copy each link and send to the staff member. The link works once and expires in 14 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!pendingOnly.length ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No pending invitations. Generate one above.</p>
          ) : (
            <div className="divide-y divide-border">
              {pendingOnly.map((inv: any) => {
                const link = buildInviteLink(inv.invite_token);
                return (
                  <div key={inv.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{inv.full_name || inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.email} · <span className="capitalize">{inv.role}</span>
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs font-mono text-muted-foreground break-all">
                      {link}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyLink(inv.invite_token)} className="gap-1.5">
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => shareWhatsApp(inv.invite_token, inv.full_name)} className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" /> Share via WhatsApp
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Team Tab ───────────────────────────────────────────────────────
function TeamTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useQuery({
    queryKey: ["team", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("clinic_id", clinicId).order("full_name");
      return data ?? [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role: role as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team"] }); toast.success("Role updated!"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><Users className="h-5 w-5 text-primary" /> Team Members</CardTitle>
        <CardDescription>Manage your clinic staff and their roles</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !members?.length ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No team members</TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.full_name || "Unnamed"}</TableCell>
                <TableCell>
                  <Select value={m.role} onValueChange={v => updateRole.mutate({ id: m.id, role: v })}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["owner", "doctor", "dentist", "hygienist", "receptionist", "assistant"].map(r =>
                        <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(m.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Vendors Tab (Enhanced) ─────────────────────────────────────────
function VendorsTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "", contact_name: "", email: "", phone: "", notes: "",
    gpay_id: "", gst_number: "", remarks: "",
  });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vendors").select("*").eq("clinic_id", clinicId).order("name");
      return data ?? [];
    },
  });

  const addVendor = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("vendors").insert({ ...form, clinic_id: clinicId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] }); setOpen(false);
      setForm({ name: "", category: "", contact_name: "", email: "", phone: "", notes: "", gpay_id: "", gst_number: "", remarks: "" });
      toast.success("Vendor added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("vendors").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendors"] }); toast.success("Vendor removed!"); },
  });

  const updateVendorField = async (id: string, field: string, value: any) => {
    const { error } = await (supabase as any).from("vendors").update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { queryClient.invalidateQueries({ queryKey: ["vendors"] }); toast.success("Updated!"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-heading text-lg font-semibold">Vendors & Suppliers</h3><p className="text-sm text-muted-foreground">Manage your dental supply vendors</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); addVendor.mutate(); }} className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Vendor Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["Dental Supplies", "Lab Services", "Equipment", "Software", "Insurance", "Marketing", "Cleaning", "Other"].map(c =>
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Person name" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>GPay ID / UPI</Label><Input value={form.gpay_id} onChange={e => setForm(f => ({ ...f, gpay_id: e.target.value }))} placeholder="vendor@upi" /></div>
              </div>
              <div className="space-y-2"><Label>GST Number</Label><Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="22AAAAA0000A1Z5" /></div>
              <div className="space-y-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Any notes about this vendor..." /></div>
              <Button type="submit" className="w-full" disabled={addVendor.isPending}>{addVendor.isPending ? "Adding..." : "Add Vendor"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="shadow-card border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>GPay / UPI</TableHead>
                <TableHead>GST No.</TableHead>
                <TableHead className="text-right">Total Business</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !vendors?.length ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No vendors yet</TableCell></TableRow>
              ) : vendors.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.contact_name || "—"}</TableCell>
                  <TableCell>{v.category ? <Badge variant="secondary" className="text-[10px]">{v.category}</Badge> : "—"}</TableCell>
                  <TableCell className="text-xs">{v.gpay_id || "—"}</TableCell>
                  <TableCell className="text-xs">{v.gst_number || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-24 text-xs text-right ml-auto" defaultValue={v.total_business || 0}
                      onBlur={e => updateVendorField(v.id, "total_business", Number(e.target.value))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-16 text-xs text-right ml-auto" defaultValue={v.total_orders || 0}
                      onBlur={e => updateVendorField(v.id, "total_orders", Number(e.target.value))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-24 text-xs text-right ml-auto" defaultValue={v.total_paid || 0}
                      onBlur={e => updateVendorField(v.id, "total_paid", Number(e.target.value))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 w-28 text-xs" defaultValue={v.remarks || ""}
                      onBlur={e => updateVendorField(v.id, "remarks", e.target.value)} placeholder="Add remark" />
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteVendor.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── QR Code Tab (Redesigned) ───────────────────────────────────────
function QRCodeTab({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const registrationUrl = `${window.location.origin}/register?clinic=${clinicId}`;

  const downloadQR = () => {
    const svg = document.querySelector("#clinic-qr-code svg") as SVGElement;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 50, 50, 500, 500);
      const a = document.createElement("a");
      a.download = "clinic-qr-code.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const printQR = () => {
    const printWin = window.open("", "_blank")!;
    const svg = document.querySelector("#clinic-qr-code svg");
    if (!svg || !printWin) return;
    printWin.document.write(`
      <html><head><title>QR Code - ${clinicName}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}
      h2{margin-bottom:8px} p{color:#666;margin:4px 0}</style></head>
      <body><h2>${clinicName}</h2><p>Scan to register & book</p>
      ${svg.outerHTML}<p style="margin-top:16px;font-size:12px">${registrationUrl}</p>
      <script>setTimeout(()=>window.print(),300)</script></body></html>
    `);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">QR Code Registration</h2>
        <p className="text-sm text-muted-foreground">Let patients self-register and book appointments by scanning a QR code</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* QR Code Display */}
        <Card className="shadow-card border-0">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <QrCode className="h-4 w-4" /> Your Clinic QR Code
            </div>
            <p className="text-xs text-muted-foreground text-center">Place this at reception, entrance, or share online</p>
            <div id="clinic-qr-code" className="p-6 bg-white rounded-2xl border shadow-sm">
              <QRCodeSVG value={registrationUrl} size={220} level="H" fgColor="#0e7490" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">{clinicName || "My Dental Clinic"}</p>
              <p className="text-xs text-muted-foreground">Scan to register & book</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          <Card className="shadow-card border-0">
            <CardHeader><CardTitle className="text-sm font-semibold">Share & Print</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={downloadQR}>
                <Download className="h-4 w-4" /> Download QR as Image
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={printQR}>
                <Printer className="h-4 w-4" /> Print QR Poster
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { navigator.clipboard.writeText(registrationUrl); toast.success("Link copied!"); }}>
                <Copy className="h-4 w-4" /> Copy Booking Link
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => window.open(registrationUrl, "_blank")}>
                <ExternalLink className="h-4 w-4" /> Preview Patient Portal
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardHeader><CardTitle className="text-sm font-semibold">Portal Link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={registrationUrl} className="text-xs font-mono bg-muted/50" />
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(registrationUrl); toast.success("Copied!"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Share this link on WhatsApp, Instagram, or your website. Patients can register themselves and book available time slots.</p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold mb-2">✨ How it works</p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                <li>1. Patient scans QR code or opens link</li>
                <li>2. Fills in their details (name, phone, medical info)</li>
                <li>3. Gets a queue token number instantly</li>
                <li>4. Patient appears in your Queue page</li>
                <li>5. Returning patients are recognized by phone number</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Integrations Tab (WhatsApp + Webhooks + Google combined) ───────
function IntegrationsTab({ clinicId }: { clinicId: string }) {
  return (
    <div className="space-y-8">
      <WhatsAppTemplatesTab clinicId={clinicId} />
      <WebhooksTab clinicId={clinicId} />
      <GoogleIntegrationTab />
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────────
export default function SettingsPage() {
  const { clinicId } = useAuth();
  const tabFromUrl = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tab")
    : null;
  const { data: clinic } = useQuery({
    queryKey: ["clinic-name", clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      const { data } = await supabase.from("clinics").select("name").eq("id", clinicId).single();
      return data;
    },
    enabled: !!clinicId,
  });

  if (!clinicId) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">No clinic found. Please complete onboarding first.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your clinic, schedule, billing, team, and more</p>
        </div>

        <Tabs defaultValue={tabFromUrl || "clinic"} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="clinic">Clinic Info</TabsTrigger>
             <TabsTrigger value="letterhead">Letterhead & PDF</TabsTrigger>
             <TabsTrigger value="team">Team</TabsTrigger>
             <TabsTrigger value="vendors">Vendors</TabsTrigger>
             <TabsTrigger value="billing">Billing/GST</TabsTrigger>
             <TabsTrigger value="coupons">Coupons</TabsTrigger>
             <TabsTrigger value="subscription">Subscription</TabsTrigger>
             <TabsTrigger value="branding">Branding</TabsTrigger>
             <TabsTrigger value="integrations">Integrations</TabsTrigger>
             <TabsTrigger value="import">Data Import</TabsTrigger>
          </TabsList>

          <TabsContent value="clinic">
            <div className="space-y-6">
              <ClinicInfoTab clinicId={clinicId} />
              <WorkingHoursPerDayTab clinicId={clinicId} />
            </div>
          </TabsContent>

          <TabsContent value="letterhead">
            <div className="space-y-6">
              <QRCodeTab clinicId={clinicId} clinicName={clinic?.name || "My Dental Clinic"} />
              <RegistrationPageBuilderTab clinicId={clinicId} />
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="space-y-6">
              <TeamTab clinicId={clinicId} />
              <InviteStaffTab clinicId={clinicId} />
            </div>
          </TabsContent>

          <TabsContent value="vendors">
            <VendorsTab clinicId={clinicId} />
          </TabsContent>

          <TabsContent value="billing">
            <BillingTab clinicId={clinicId} />
          </TabsContent>

           <TabsContent value="coupons">
             <DiscountCouponsTab clinicId={clinicId} />
           </TabsContent>

           <TabsContent value="subscription">
             <SubscriptionPlanTab clinicId={clinicId} />
           </TabsContent>

           <TabsContent value="branding">
             <ThemeBrandingTab clinicId={clinicId} />
           </TabsContent>

           <TabsContent value="integrations">
             <IntegrationsTab clinicId={clinicId} />
           </TabsContent>

           <TabsContent value="import">
             <DataImportTab clinicId={clinicId} />
           </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
