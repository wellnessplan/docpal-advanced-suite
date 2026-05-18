import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Search, Phone, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "interested", "converted", "lost"] as const;
const SOURCES = ["Walk-in", "Phone", "WhatsApp", "Instagram", "Facebook", "Google", "Referral", "Website", "Other"];

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-purple-100 text-purple-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const emptyForm = { full_name: "", phone: "", email: "", source: "Walk-in", interested_in: "", notes: "" };

export default function Leads() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", clinicId],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("leads")
          .select("*")
          .eq("clinic_id", clinicId!)
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!clinicId,
  });

  const addLead = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await supabase.from("leads").insert({
        clinic_id: clinicId,
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        source: form.source,
        interested_in: form.interested_in || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Lead added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status updated");
    },
  });

  const filtered = leads.filter((l: any) =>
    l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm">{leads.filter((l: any) => l.status === "new").length} new leads · {leads.length} total</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>Capture a new enquiry from a prospective patient.</DialogDescription>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addLead.mutate(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Source</Label>
                    <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interested In</Label>
                    <Input value={form.interested_in} onChange={e => setForm(f => ({ ...f, interested_in: e.target.value }))} placeholder="Braces, Cleaning..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes..." />
                </div>
                <Button type="submit" className="w-full" disabled={addLead.isPending}>
                  {addLead.isPending ? "Adding..." : "Add Lead"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {STATUSES.map(status => (
            <Card key={status}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
                <p className="text-xl font-bold">{leads.filter((l: any) => l.status === status).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No leads yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Capture enquiries from walk-ins, calls, or social media</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead: any) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{lead.full_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.source} · {lead.interested_in || "General enquiry"}</p>
                  </div>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="p-2 rounded-lg hover:bg-muted">
                      <Phone className="h-4 w-4 text-primary" />
                    </a>
                  )}
                  <Badge className={statusColors[lead.status] || ""} variant="secondary">{lead.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUSES.filter(s => s !== lead.status).map(s => (
                        <DropdownMenuItem key={s} onClick={() => updateStatus.mutate({ id: lead.id, status: s })} className="capitalize">
                          Mark as {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
