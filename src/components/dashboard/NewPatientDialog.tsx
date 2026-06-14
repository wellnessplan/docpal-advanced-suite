import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after successful save. Receives created patient (id + full_name). */
  onCreated?: (patient: { id: string; full_name: string }) => void;
  /** Optional CTA besides default "Save". E.g. "Save & Book Appointment" */
  extraAction?: { label: string; onClick: (patient: { id: string; full_name: string }) => void };
}

export default function NewPatientDialog({ open, onOpenChange, onCreated, extraAction }: Props) {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [phoneError, setPhoneError] = useState("");
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", date_of_birth: "", address: "", notes: "", gender: "",
  });
  const today = new Date().toISOString().split("T")[0];
  const [pendingExtra, setPendingExtra] = useState(false);

  const reset = () => {
    setForm({ full_name: "", email: "", phone: "", date_of_birth: "", address: "", notes: "", gender: "" });
    setPhoneError("");
    setPendingExtra(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      if (!form.full_name.trim()) throw new Error("Patient name is required");
      if (form.phone) {
        const digits = form.phone.replace(/\D/g, "");
        if (digits.length !== 10) throw new Error("Phone must be exactly 10 digits");
      }
      if (form.date_of_birth) {
        const dob = new Date(form.date_of_birth);
        if (dob > new Date()) throw new Error("Date of birth cannot be in the future");
      }
      const { data, error } = await supabase.from("patients").insert({
        full_name: form.full_name.trim(),
        clinic_id: clinicId,
        email: form.email?.trim() || null,
        phone: form.phone ? form.phone.replace(/\D/g, "") : null,
        date_of_birth: form.date_of_birth || null,
        address: form.address?.trim() || null,
        notes: form.notes?.trim() || null,
        gender: form.gender || null,
      }).select("id, full_name").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient-stats"] });
      qc.invalidateQueries({ queryKey: ["dash-pcount"] });
      toast.success(`Patient ${patient.full_name} registered`);
      const triggerExtra = pendingExtra && extraAction;
      onOpenChange(false);
      reset();
      if (triggerExtra) extraAction!.onClick(patient);
      else onCreated?.(patient);
    },
    onError: (e: any) => { setPendingExtra(false); toast.error(e.message); },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Patient</DialogTitle>
          <DialogDescription>Add a patient to your clinic records.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setPendingExtra(false); save.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required maxLength={100} className="h-11" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone (10 digits)</Label>
              <Input value={form.phone} maxLength={10} inputMode="numeric"
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setForm(f => ({ ...f, phone: val }));
                  setPhoneError(val && val.length !== 10 ? "Must be 10 digits" : "");
                }} placeholder="9876543210" className="h-11" />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" max={today} value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="optional" className="h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="optional" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="optional" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {extraAction && (
              <Button type="button" variant="outline" disabled={save.isPending || !!phoneError}
                onClick={() => { setPendingExtra(true); save.mutate(); }}>
                {extraAction.label}
              </Button>
            )}
            <Button type="submit" disabled={save.isPending || !!phoneError}>
              {save.isPending ? "Saving..." : "Save Patient"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
