import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Image } from "lucide-react";
import { toast } from "sonner";

const PHOTO_TYPES = [
  "Frontal (Extraoral)", "Lateral (Extraoral)", "Oblique (Extraoral)",
  "Frontal (Intraoral)", "Right Buccal", "Left Buccal",
  "Upper Occlusal", "Lower Occlusal", "Smile", "Other",
];

const CATEGORIES = [
  { value: "extraoral", label: "Extraoral" },
  { value: "intraoral", label: "Intraoral" },
  { value: "smile", label: "Smile" },
  { value: "other", label: "Other" },
];

export default function OrthoPhotoGallery({ caseId, clinicId }: { caseId: string; clinicId: string }) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState("");
  const [category, setCategory] = useState("intraoral");
  const [visitNumber, setVisitNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: photos = [] } = useQuery({
    queryKey: ["ortho-photos", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_photo_records").select("*").eq("ortho_case_id", caseId).order("record_date", { ascending: false });
      return data ?? [];
    },
  });

  const uploadPhoto = async () => {
    if (!selectedFile || !photoType) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split(".").pop();
      const path = `ortho/${caseId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("patient-documents").upload(path, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(path);

      const { error } = await supabase.from("ortho_photo_records").insert({
        ortho_case_id: caseId,
        photo_type: photoType,
        photo_category: category,
        photo_url: urlData.publicUrl,
        visit_number: visitNumber ? parseInt(visitNumber) : null,
        consent_for_education: consent,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["ortho-photos", caseId] });
      setShowUpload(false);
      setSelectedFile(null);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const groupedByDate = photos.reduce((acc: Record<string, any[]>, p: any) => {
    const date = p.record_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Photo Gallery ({photos.length} photos)</h3>
        <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1"><Plus className="h-4 w-4" /> Upload Photo</Button>
      </div>

      {Object.entries(groupedByDate).map(([date, datePhotos]) => (
        <div key={date}>
          <p className="text-sm font-medium text-muted-foreground mb-2">{date}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(datePhotos as any[]).map((p: any) => (
              <Card key={p.id} className="shadow-card border-0 overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <img src={p.photo_url} alt={p.photo_type} className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = "none"; }} />
                </div>
                <CardContent className="p-2">
                  <p className="text-xs font-medium truncate">{p.photo_type}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{p.photo_category}</Badge>
                    {p.visit_number && <Badge variant="secondary" className="text-xs">V{p.visit_number}</Badge>}
                    {p.consent_for_education && <Badge className="bg-success/10 text-success text-xs">Consent</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {photos.length === 0 && <p className="text-center text-muted-foreground py-8">No photos uploaded yet</p>}

      {showUpload && (
        <Dialog open onOpenChange={() => setShowUpload(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Clinical Photo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Photo File</Label>
                <Input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label>Photo Type</Label>
                  <Select value={photoType} onValueChange={setPhotoType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{PHOTO_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Visit Number</Label><Input type="number" value={visitNumber} onChange={e => setVisitNumber(e.target.value)} placeholder="Optional" /></div>
              <div className="flex items-center gap-2"><Checkbox checked={consent} onCheckedChange={v => setConsent(!!v)} /><Label>Patient consents to use for education/social media</Label></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button><Button onClick={uploadPhoto} disabled={!selectedFile || !photoType || uploading}>{uploading ? "Uploading..." : "Upload"}</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
