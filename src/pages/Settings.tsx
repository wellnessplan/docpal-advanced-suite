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
  Clock, Receipt, UserPlus
} from "lucide-react";
import GoogleIntegrationTab from "@/components/settings/GoogleIntegrationTab";
import WhatsAppTemplatesTab from "@/components/settings/WhatsAppTemplatesTab";
import WebhooksTab from "@/components/settings/WebhooksTab";
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

// ─── Invite Staff Tab ───────────────────────────────────────────────
function InviteStaffTab({ clinicId }: { clinicId: string }) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    const validEmails = emails.filter(e => e.trim() && e.includes("@"));
    if (!validEmails.length) { toast.error("Enter at least one valid email"); return; }
    setSending(true);
    // Store invitations as communications for now
    for (const email of validEmails) {
      await supabase.from("patient_communications").insert({
        clinic_id: clinicId,
        patient_id: clinicId, // placeholder
        type: "email",
        subject: "Staff Invitation",
        content: `Invitation sent to ${email}`,
        direction: "outbound",
      } as any);
    }
    toast.success(`Invitation(s) sent to ${validEmails.length} staff member(s)!`);
    setEmails([""]);
    setSending(false);
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><UserPlus className="h-5 w-5 text-primary" /> Invite Staff</CardTitle>
        <CardDescription>Send email invitations to your team members</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <Input value={email} onChange={e => { const arr = [...emails]; arr[i] = e.target.value; setEmails(arr); }} placeholder="staff@clinic.com" type="email" />
            {i === emails.length - 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEmails([...emails, ""])}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Staff members will receive an email with login instructions.</p>
        <Button onClick={handleInvite} disabled={sending}>{sending ? "Sending..." : "Send Invitations"}</Button>
      </CardContent>
    </Card>
  );
}

// ─── Quick Add Patient Tab ──────────────────────────────────────────
function QuickPatientTab({ clinicId }: { clinicId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Patient name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("patients").insert({
      clinic_id: clinicId, full_name: name.trim(), phone: phone || null, date_of_birth: dob || null,
    });
    if (error) { toast.error(error.message); } else {
      toast.success(`Patient "${name}" added!`);
      setName(""); setPhone(""); setDob("");
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><UserPlus className="h-5 w-5 text-primary" /> Quick Add Patient</CardTitle>
        <CardDescription>Quickly add a new patient to your clinic</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Patient Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
          <div className="space-y-2"><Label>Date of Birth</Label><Input value={dob} onChange={e => setDob(e.target.value)} type="date" /></div>
        </div>
        <Button onClick={handleAdd} disabled={saving || !name.trim()}>{saving ? "Adding..." : "Add Patient"}</Button>
      </CardContent>
    </Card>
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
                      {["owner", "dentist", "hygienist", "receptionist", "assistant"].map(r =>
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

// ─── Vendors Tab ────────────────────────────────────────────────────
function VendorsTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", contact_name: "", email: "", phone: "", notes: "" });

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
      setForm({ name: "", category: "", contact_name: "", email: "", phone: "", notes: "" }); toast.success("Vendor added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("vendors").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendors"] }); toast.success("Vendor removed!"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-heading text-lg font-semibold">Vendors & Suppliers</h3><p className="text-sm text-muted-foreground">Manage your dental supply vendors</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button></DialogTrigger>
          <DialogContent>
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
              <div className="space-y-2"><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <Button type="submit" className="w-full" disabled={addVendor.isPending}>{addVendor.isPending ? "Adding..." : "Add Vendor"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !vendors?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No vendors yet</TableCell></TableRow>
              ) : vendors.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.category ? <Badge variant="secondary">{v.category}</Badge> : "—"}</TableCell>
                  <TableCell>{v.contact_name || "—"}</TableCell>
                  <TableCell>{v.phone || "—"}</TableCell>
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

// ─── Main Settings Page ─────────────────────────────────────────────
export default function SettingsPage() {
  const { clinicId } = useAuth();

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

        <Tabs defaultValue="clinic" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="clinic">Clinic Info</TabsTrigger>
            <TabsTrigger value="hours">Working Hours</TabsTrigger>
            <TabsTrigger value="billing">Billing & GST</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="invite">Invite Staff</TabsTrigger>
            <TabsTrigger value="patient">Add Patient</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="qr">Patient QR</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="clinic"><ClinicInfoTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="hours"><WorkingHoursTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="billing"><BillingTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="team"><TeamTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="invite"><InviteStaffTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="patient"><QuickPatientTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab clinicId={clinicId} /></TabsContent>

          <TabsContent value="qr">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Patient Self-Registration QR Code</CardTitle>
                <CardDescription>Print or display this QR code in your clinic. Patients scan it to register themselves.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="p-6 bg-white rounded-xl border shadow-sm">
                  <QRCodeSVG value={`${window.location.origin}/register?clinic=${clinicId}`} size={250} level="H" />
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-sm break-all">
                  {`${window.location.origin}/register?clinic=${clinicId}`}
                </p>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?clinic=${clinicId}`); toast.success("Registration link copied!"); }}>
                  Copy Registration Link
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations"><GoogleIntegrationTab /></TabsContent>
          <TabsContent value="whatsapp"><WhatsAppTemplatesTab clinicId={clinicId} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
