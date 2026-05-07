import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface Clinic {
  id: string;
  name: string;
  group_id: string | null;
}

export default function BranchSwitcher() {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Clinic[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!profile?.group_id) return;
    supabase
      .from("clinics")
      .select("id, name, group_id")
      .eq("group_id", profile.group_id)
      .order("name")
      .then(({ data }) => setBranches((data as any) || []));
  }, [profile?.group_id, profile?.clinic_id]);

  const current = branches.find((b) => b.id === profile?.clinic_id);

  // Hide if only one branch
  if (branches.length <= 1) return null;

  const switchTo = async (clinicId: string) => {
    if (clinicId === profile?.clinic_id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const { error } = await (supabase as any).rpc("switch_active_branch", { p_clinic_id: clinicId });
      if (error) throw error;
      await refreshProfile();
      qc.invalidateQueries();
      toast.success("Branch switched");
      setOpen(false);
      // Soft reload to refresh all clinic-scoped state
      setTimeout(() => window.location.reload(), 200);
    } catch (e: any) {
      toast.error(e.message || "Failed to switch");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={switching}>
          <Building2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
            {current?.name || "Branch"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="end">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Switch branch
        </div>
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => switchTo(b.id)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left"
          >
            <span className="truncate">{b.name}</span>
            {b.id === profile?.clinic_id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>
        ))}
        <div className="border-t mt-1 pt-1">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings?tab=branches");
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-muted-foreground"
          >
            <Plus className="h-4 w-4" /> Manage branches
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
