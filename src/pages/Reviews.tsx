import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Star, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Reviews() {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", rating: "5", feedback: "" });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId!).order("full_name");
      return data || [];
    },
    enabled: !!clinicId,
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", clinicId],
    queryFn: async () => {
      const { data } = await (supabase.from("reviews") as any)
        .select("*, patients(full_name)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const addReview = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { error } = await (supabase.from("reviews") as any).insert({
        clinic_id: clinicId,
        patient_id: form.patient_id || null,
        rating: parseInt(form.rating),
        feedback: form.feedback || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      setOpen(false);
      setForm({ patient_id: "", rating: "5", feedback: "" });
      toast.success("Review recorded!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "N/A";

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Reviews & Feedback</h1>
            <p className="text-muted-foreground text-sm">Average rating: {avgRating} ⭐ · {reviews.length} reviews</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Add Review</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Patient Feedback</DialogTitle>
                <DialogDescription>Capture a patient's rating and feedback after their visit.</DialogDescription>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addReview.mutate(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Patient</Label>
                  <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select patient..." /></SelectTrigger>
                    <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Rating</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, rating: String(star) }))}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star className={`h-7 w-7 ${parseInt(form.rating) >= star ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Feedback</Label>
                  <Textarea value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} rows={3} placeholder="What did the patient say..." />
                </div>
                <Button type="submit" className="w-full" disabled={addReview.isPending}>
                  {addReview.isPending ? "Saving..." : "Save Review"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {[5, 4, 3, 2, 1].map(star => (
            <Card key={star}>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {Array.from({ length: star }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg font-bold">{reviews.filter((r: any) => r.rating === star).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No reviews yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Record patient feedback after treatment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reviews.map((r: any) => (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{r.patients?.full_name || "Anonymous"}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                  {r.feedback && <p className="text-sm text-muted-foreground">{r.feedback}</p>}
                  <p className="text-xs text-muted-foreground/60">{new Date(r.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
