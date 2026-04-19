import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const DISMISS_KEY = "db_profile_completion_dismissed";

/**
 * One-time, dismissible modal nudging users to finish clinic profile.
 * Shows on Dashboard if clinic name is empty / contains "My Clinic" placeholder.
 */
export default function ProfileCompletionModal() {
  const { profile, clinicId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    // Show only when essential info is missing: full_name OR clinic looks placeholder
    const placeholder = !profile?.full_name || profile.full_name.trim().length < 2;
    if (placeholder) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [clinicId, profile]);

  const handleSkip = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };
  const handleGo = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
    navigate("/settings");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleSkip(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-heading text-lg">
            Welcome to DoctorsBuddy
          </DialogTitle>
          <DialogDescription className="text-center">
            Complete your clinic profile (name, logo, contact) so it appears
            beautifully on every prescription, invoice and receipt you share.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row sm:justify-center gap-2 pt-2">
          <Button variant="outline" onClick={handleSkip} className="flex-1 sm:flex-none">
            Skip for now
          </Button>
          <Button onClick={handleGo} className="flex-1 sm:flex-none">
            Complete profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
