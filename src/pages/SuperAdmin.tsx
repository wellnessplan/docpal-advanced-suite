import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import {
  Shield, Building2, Users, CheckCircle, XCircle, Clock,
  Search, RefreshCw, Eye
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ClinicRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  subscription?: {
    id: string;
    status: string;
    trial_ends_at: string | null;
    approved_at: string | null;
    plan_name: string | null;
    amount: number;
  };
  patient_count?: number;
  staff_count?: number;
}

const statusColors: Record<string, string> = {
  trial: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  expired: "bg-amber-100 text-amber-700 border-amber-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
  pending_approval: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function SuperAdminPage() {
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useSuperAdmin();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: clinics, isLoading } = useQuery({
    queryKey: ["admin-clinics"],
    queryFn: async () => {
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("id, name, phone, email, created_at")
        .order("created_at", { ascending: false });

      if (!clinicData) return [];

      const { data: subs } = await supabase
        .from("clinic_subscriptions" as any)
        .select("*");

      const { data: patientCounts } = await supabase
        .from("patients")
        .select("clinic_id");

      const { data: staffCounts } = await supabase
        .from("profiles")
        .select("clinic_id");

      const subMap = new Map((subs || []).map((s: any) => [s.clinic_id, s]));
      const pCountMap = new Map<string, number>();
      const sCountMap = new Map<string, number>();

      (patientCounts || []).forEach((p: any) => {
        pCountMap.set(p.clinic_id, (pCountMap.get(p.clinic_id) || 0) + 1);
      });
      (staffCounts || []).forEach((s: any) => {
        if (s.clinic_id) sCountMap.set(s.clinic_id, (sCountMap.get(s.clinic_id) || 0) + 1);
      });

      return clinicData.map((c): ClinicRow => ({
        ...c,
        subscription: subMap.get(c.id) as any,
        patient_count: pCountMap.get(c.id) || 0,
        staff_count: sCountMap.get(c.id) || 0,
      }));
    },
    enabled: !!isSuperAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ clinicId, newStatus }: { clinicId: string; newStatus: string }) => {
      const updateData: any = { status: newStatus };
      if (newStatus === "active") updateData.approved_at = new Date().toISOString();

      const { error } = await supabase
        .from("clinic_subscriptions" as any)
        .update(updateData)
        .eq("clinic_id", clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Subscription status updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Checking access...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const getEffectiveStatus = (sub: any) => {
    if (!sub) return "no_subscription";
    if (sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) <= new Date()) return "trial_expired";
    return sub.status;
  };

  const filtered = (clinics || []).filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const effectiveStatus = getEffectiveStatus(c.subscription);
    const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: clinics?.length || 0,
    trial: clinics?.filter(c => getEffectiveStatus(c.subscription) === "trial").length || 0,
    active: clinics?.filter(c => getEffectiveStatus(c.subscription) === "active").length || 0,
    expired: clinics?.filter(c => ["expired", "trial_expired"].includes(getEffectiveStatus(c.subscription))).length || 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Super Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage all registered clinics and subscriptions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Clinics", value: stats.total, icon: Building2, color: "text-foreground" },
            { label: "Active Trials", value: stats.trial, icon: Clock, color: "text-blue-600" },
            { label: "Paid / Active", value: stats.active, icon: CheckCircle, color: "text-green-600" },
            { label: "Expired", value: stats.expired, icon: XCircle, color: "text-amber-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search clinics..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clinics Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Trial Ends</TableHead>
                  <TableHead className="hidden md:table-cell">Patients</TableHead>
                  <TableHead className="hidden md:table-cell">Staff</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading clinics...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No clinics found</TableCell>
                  </TableRow>
                ) : filtered.map(clinic => {
                  const effectiveStatus = getEffectiveStatus(clinic.subscription);
                  const trialEnd = clinic.subscription?.trial_ends_at
                    ? new Date(clinic.subscription.trial_ends_at).toLocaleDateString()
                    : "—";

                  return (
                    <TableRow key={clinic.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{clinic.name}</p>
                          <p className="text-xs text-muted-foreground">{clinic.email || clinic.phone || "No contact"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[effectiveStatus] || ""}>
                          {effectiveStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{trialEnd}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5" /> {clinic.patient_count}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{clinic.staff_count}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {effectiveStatus !== "active" && (
                            <Button size="sm" variant="outline" className="text-green-600 h-8 text-xs"
                              onClick={() => updateStatus.mutate({ clinicId: clinic.id, newStatus: "active" })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Activate
                            </Button>
                          )}
                          {effectiveStatus !== "suspended" && (
                            <Button size="sm" variant="outline" className="text-destructive h-8 text-xs"
                              onClick={() => updateStatus.mutate({ clinicId: clinic.id, newStatus: "suspended" })}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Suspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
