import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Upload, ChevronRight } from "lucide-react";

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clinicName, setClinicName] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleFinish = async () => {
    if (!user || !clinicName.trim()) return;
    setLoading(true);

    try {
      // Create clinic
      const { data: newClinic, error: clinicError } = await (supabase
        .from("clinics") as any).insert({
          name: clinicName.trim(),
          phone: clinicPhone || null,
          address: clinicAddress || null,
          email: clinicEmail || null,
        }).select("id").single();

      if (clinicError) {
        toast.error("Failed to create clinic: " + clinicError.message);
        setLoading(false);
        return;
      }

      const clinicId = newClinic?.id as string;

      // Link profile to clinic
      if (clinicId) {
        await (supabase.from("profiles") as any)
          .update({ clinic_id: clinicId })
          .eq("user_id", user.id);
      }

      // Upload logo if provided
      if (logoFile && clinicId) {
        const ext = logoFile.name.split(".").pop();
        const path = `${clinicId}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("clinic-logos")
          .upload(path, logoFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from("clinic-logos")
            .getPublicUrl(path);
          await (supabase.from("clinics") as any)
            .update({ logo_url: publicUrl.publicUrl })
            .eq("id", clinicId);
        }
      }

      await refreshProfile();
      toast.success("Clinic created! You can configure more in Settings.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Something went wrong: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Set Up Your Clinic</h1>
          <p className="mt-1 text-muted-foreground text-sm">Just the basics — you can configure everything else in Settings</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted hover:border-primary transition-colors overflow-hidden"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">
                Upload clinic logo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="space-y-2">
              <Label>Clinic Name *</Label>
              <Input value={clinicName} onChange={e => setClinicName(e.target.value)} required placeholder="Happy Smiles Dental" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={clinicEmail} onChange={e => setClinicEmail(e.target.value)} placeholder="clinic@email.com" type="email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} placeholder="123 Main St, City" />
            </div>

            <Button onClick={handleFinish} disabled={!clinicName.trim() || loading} className="w-full gap-1 mt-4">
              {loading ? "Creating..." : <>Get Started <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
