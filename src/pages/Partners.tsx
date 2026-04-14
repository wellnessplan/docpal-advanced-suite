import { useState } from "react";
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
import { Plus, Trash2, Phone, MessageCircle, FlaskConical, Package, Users2, Loader2, Save } from "lucide-react";
import LabDirectoryTab from "@/components/settings/LabDirectoryTab";

// ─── Vendors Tab ────────────────────────────────────────────────────
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

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await (supabase as any).from("vendors").update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { queryClient.invalidateQueries({ queryKey: ["vendors"] }); }
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
                <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>GPay ID / UPI</Label><Input value={form.gpay_id} onChange={e => setForm(f => ({ ...f, gpay_id: e.target.value }))} placeholder="vendor@upi" /></div>
              </div>
              <div className="space-y-2"><Label>GST Number</Label><Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="22AAAAA0000A1Z5" /></div>
              <div className="space-y-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} /></div>
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
                <TableHead>GPay/UPI</TableHead>
                <TableHead>GST No.</TableHead>
                <TableHead className="text-right">Business (₹)</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Paid (₹)</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : !vendors?.length ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No vendors added yet</TableCell></TableRow>
              ) : vendors.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{v.name}</p>
                    {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{v.contact_name || "—"}</TableCell>
                  <TableCell>{v.category ? <Badge variant="secondary" className="text-[10px]">{v.category}</Badge> : "—"}</TableCell>
                  <TableCell className="text-xs">{v.gpay_id || "—"}</TableCell>
                  <TableCell className="text-xs">{v.gst_number || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-24 text-xs text-right ml-auto" defaultValue={v.total_business || 0}
                      onBlur={e => updateField(v.id, "total_business", Number(e.target.value))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-16 text-xs text-right ml-auto" defaultValue={v.total_orders || 0}
                      onBlur={e => updateField(v.id, "total_orders", Number(e.target.value))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="h-7 w-24 text-xs text-right ml-auto" defaultValue={v.total_paid || 0}
                      onBlur={e => updateField(v.id, "total_paid", Number(e.target.value))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7 w-28 text-xs" defaultValue={v.remarks || ""}
                      onBlur={e => updateField(v.id, "remarks", e.target.value)} placeholder="Add remark" />
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

// ─── Important Contacts ─────────────────────────────────────────────
function ContactsTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", phone: "", email: "", notes: "" });

  const settingsKey = "important_contacts";
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["important-contacts", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_settings").select("*").eq("clinic_id", clinicId).eq("setting_key", settingsKey).maybeSingle();
      if (data?.setting_value) { try { return JSON.parse(data.setting_value); } catch { return []; } }
      return [];
    },
  });

  const saveContacts = async (updated: any[]) => {
    const { data: existing } = await supabase.from("clinic_settings").select("id").eq("clinic_id", clinicId).eq("setting_key", settingsKey).maybeSingle();
    const value = JSON.stringify(updated);
    if (existing) {
      await supabase.from("clinic_settings").update({ setting_value: value }).eq("id", existing.id);
    } else {
      await supabase.from("clinic_settings").insert({ clinic_id: clinicId, setting_key: settingsKey, setting_value: value });
    }
    queryClient.invalidateQueries({ queryKey: ["important-contacts"] });
  };

  const addContact = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const updated = [...contacts, { ...form, id: crypto.randomUUID() }];
    await saveContacts(updated);
    setForm({ name: "", role: "", phone: "", email: "", notes: "" });
    setOpen(false);
    toast.success("Contact added!");
  };

  const removeContact = async (id: string) => {
    const updated = contacts.filter((c: any) => c.id !== id);
    await saveContacts(updated);
    toast.success("Contact removed!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-heading text-lg font-semibold">Important Contacts</h3><p className="text-sm text-muted-foreground">Emergency contacts, consultants, and key personnel</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Contact</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Role / Title</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Oral Surgeon" /></div>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <Button className="w-full" onClick={addContact}>Add Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Notes</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {!contacts.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No contacts added yet</TableCell></TableRow>
              ) : contacts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.role || "—"}</TableCell>
                  <TableCell>{c.phone ? <a href={`tel:${c.phone}`} className="text-primary hover:underline text-sm">{c.phone}</a> : "—"}</TableCell>
                  <TableCell className="text-sm">{c.email || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.notes || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeContact(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Partners Page ─────────────────────────────────────────────
export default function Partners() {
  const { clinicId } = useAuth();

  if (!clinicId) {
    return <DashboardLayout><p className="text-muted-foreground">No clinic found.</p></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold">Partners</h1>
          <p className="text-muted-foreground">Vendors, labs, and important contacts for your clinic</p>
        </div>

        <Tabs defaultValue="vendors" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="vendors">Vendors & Suppliers</TabsTrigger>
            <TabsTrigger value="labs">Lab Directory</TabsTrigger>
            <TabsTrigger value="contacts">Important Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors"><VendorsTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="labs"><LabDirectoryTab clinicId={clinicId} /></TabsContent>
          <TabsContent value="contacts"><ContactsTab clinicId={clinicId} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
