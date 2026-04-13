import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileCheck } from "lucide-react";
import { toast } from "sonner";

const CONSENT_TEMPLATES: Record<string, { title: string; content: string }> = {
  fixed_appliance: {
    title: "Fixed Appliance (Braces) Consent",
    content: `I understand that orthodontic treatment with fixed braces involves:\n\n• Risks of decalcification (white spots) on teeth if oral hygiene is not maintained\n• Possibility of root resorption (shortening of tooth roots)\n• Risk of relapse after treatment if retainers are not worn as directed\n• Broken brackets may occur and require additional visits\n• Treatment duration is an estimate and may vary\n• Temporary discomfort after adjustments is normal\n\nI have been informed of these risks and consent to proceed with treatment.`,
  },
  clear_aligner: {
    title: "Clear Aligner Consent",
    content: `I understand that orthodontic treatment with clear aligners involves:\n\n• Requirement to wear aligners 20-22 hours per day for treatment effectiveness\n• Possibility of refinement aligners being needed, which may extend treatment time\n• Additional costs may apply for refinements or lost/damaged aligners\n• IPR (interproximal reduction) may be required during treatment\n• Results depend on compliance with wearing instructions\n\nI have been informed and consent to proceed.`,
  },
  surgical_ortho: {
    title: "Surgical-Orthodontic Consent",
    content: `I understand that my orthodontic treatment involves a surgical component:\n\n• Jaw surgery (orthognathic surgery) will be required as part of the treatment plan\n• Surgical risks include numbness, swelling, infection, and jaw stiffness\n• Post-surgical orthodontic treatment will be required\n• Recovery period typically takes 4-6 weeks\n• I will be referred to an oral surgeon for the surgical procedure\n\nI have been informed of all risks and consent to proceed.`,
  },
  retainer_agreement: {
    title: "Retainer Wear Agreement",
    content: `I understand and agree to the following retainer wear schedule:\n\n• Full-time wear (22h/day) for the first 3 months after debonding\n• Night-time wear only for the next 6 months\n• Every alternate night for the following 6 months\n• Minimum 3 nights/week indefinitely\n\nI understand that failure to wear retainers as directed may result in teeth shifting back, and retreatment would incur additional costs.`,
  },
};

export default function OrthoConsentForms({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [formType, setFormType] = useState("fixed_appliance");
  const [content, setContent] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");

  const { data: forms = [] } = useQuery({
    queryKey: ["ortho-consent", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("ortho_consent_forms").select("*").eq("ortho_case_id", caseId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const template = CONSENT_TEMPLATES[formType];
      const { error } = await supabase.from("ortho_consent_forms").insert({
        ortho_case_id: caseId,
        form_type: formType,
        form_content: content || template?.content || "",
        is_minor: isMinor,
        guardian_name: isMinor ? guardianName : null,
        signed_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ortho-consent", caseId] });
      setShowAdd(false);
      toast.success("Consent form saved");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Consent Forms</h3>
        <Button size="sm" onClick={() => { setShowAdd(true); setContent(CONSENT_TEMPLATES[formType]?.content || ""); }} className="gap-1"><Plus className="h-4 w-4" /> Add Consent</Button>
      </div>

      <div className="space-y-3">
        {forms.map((f: any) => (
          <Card key={f.id} className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-success" />
                    <span className="font-medium">{CONSENT_TEMPLATES[f.form_type]?.title || f.form_type}</span>
                    <Badge className="bg-success/10 text-success text-xs">Signed</Badge>
                    {f.is_minor && <Badge variant="outline" className="text-xs">Minor — {f.guardian_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Signed: {new Date(f.signed_at || f.created_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {forms.length === 0 && <p className="text-center text-muted-foreground py-8">No consent forms recorded</p>}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Consent Form</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Form Type</Label>
                <Select value={formType} onValueChange={v => { setFormType(v); setContent(CONSENT_TEMPLATES[v]?.content || ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONSENT_TEMPLATES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Consent Content</Label><Textarea value={content} onChange={e => setContent(e.target.value)} rows={10} /></div>
              <div className="flex items-center gap-2"><Checkbox checked={isMinor} onCheckedChange={v => setIsMinor(!!v)} /><Label>Minor patient (requires guardian signature)</Label></div>
              {isMinor && <div className="space-y-1"><Label>Guardian Name</Label><Input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Parent/Guardian name" /></div>}
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createForm.mutate()}>Save Consent</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
