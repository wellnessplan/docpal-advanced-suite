import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, FileText, Download, AlertTriangle, Lock, FileLock2, FileCheck2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function CompliancePrivacyTab() {
  const { clinicId } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["compliance-stats", clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      const [{ count: patients }, { count: consents }, { count: deletions }] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).not("data_consent_at", "is", null),
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).not("data_deletion_requested_at", "is", null),
      ]);
      return { patients: patients ?? 0, consents: consents ?? 0, deletions: deletions ?? 0 };
    },
    enabled: !!clinicId,
  });

  const exportAllPatientData = async () => {
    if (!clinicId) return;
    const { data: patients } = await supabase.from("patients").select("*").eq("clinic_id", clinicId);
    const blob = new Blob([JSON.stringify(patients, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinic-data-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Compliance & Privacy
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Healthcare data protection, patient consent, and regulatory compliance documentation.
        </p>
      </div>

      <Alert className="border-warning/30 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-sm">Legal disclaimer</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          The documents and controls below are <strong>templates and operational tools</strong>, not legal advice.
          Full HIPAA, GDPR, or DPDPA compliance requires signed Business Associate Agreements (BAAs) with your
          infrastructure providers and review by qualified legal counsel.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="shadow-card border-0">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold font-heading">{stats.patients}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Data Consent Recorded</p>
              <p className="text-2xl font-bold font-heading text-success">{stats.consents}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Erasure Requests</p>
              <p className="text-2xl font-bold font-heading">{stats.deletions}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HIPAA-Style Documentation */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <FileLock2 className="h-4 w-4" />
            HIPAA-Style Safeguards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ComplianceItem
            title="Administrative Safeguards"
            status="implemented"
            items={[
              "Role-based access control (owner / dentist / receptionist / staff)",
              "Audit log of patient data access and changes (Audit Log page)",
              "Multi-tenant isolation: each clinic only sees its own data",
            ]}
          />
          <ComplianceItem
            title="Physical Safeguards"
            status="provider"
            items={[
              "Server hosting handled by infrastructure provider (cloud datacenter)",
              "Encrypted backups managed automatically",
            ]}
          />
          <ComplianceItem
            title="Technical Safeguards"
            status="implemented"
            items={[
              "All data transmitted over HTTPS/TLS",
              "At-rest encryption for database and file storage",
              "Row-level security on every table",
              "Authentication required for all clinic data access",
            ]}
          />
          <ComplianceItem
            title="Required Documents (your responsibility)"
            status="todo"
            items={[
              "Business Associate Agreement (BAA) with infrastructure providers",
              "Internal Privacy Policy & Notice of Privacy Practices",
              "Staff HIPAA training records",
              "Breach notification procedure",
            ]}
          />
        </CardContent>
      </Card>

      {/* GDPR / Data subject rights */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <FileCheck2 className="h-4 w-4" />
            GDPR / DPDPA — Data Subject Rights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Right to Access (Article 15)</p>
            <p className="text-xs text-muted-foreground">
              Export complete patient data on request. Use the patient profile page to export an individual record,
              or export all clinic data below.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={exportAllPatientData}>
              <Download className="h-3.5 w-3.5" /> Export all patient data (JSON)
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Right to Erasure (Article 17)</p>
            <p className="text-xs text-muted-foreground">
              Patients can be anonymized via the GDPR delete action on their profile page. Records are kept (for
              audit/billing trails) but personally identifiable fields are wiped.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Right to Rectification (Article 16)</p>
            <p className="text-xs text-muted-foreground">
              All patient data is editable from the patient profile page.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Consent Management</p>
            <p className="text-xs text-muted-foreground">
              When adding new patients, prompt them to consent to data storage. Consent timestamps are recorded
              on the patient record. Marketing communications require separate consent.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <FileText className="h-4 w-4" />
            Document Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <DocLink title="Privacy Policy template" href="/privacy" />
          <DocLink title="Terms of Service template" href="/terms" />
          <DocLink title="BAA template (placeholder)" />
          <DocLink title="Patient Notice of Privacy Practices (placeholder)" />
          <DocLink title="Data Processing Agreement (placeholder)" />
          <DocLink title="Breach Notification Procedure (placeholder)" />
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceItem({
  title,
  status,
  items,
}: {
  title: string;
  status: "implemented" | "provider" | "todo";
  items: string[];
}) {
  const meta = {
    implemented: { label: "Implemented", color: "bg-success/10 text-success border-success/30" },
    provider: { label: "Provider-managed", color: "bg-primary/10 text-primary border-primary/30" },
    todo: { label: "Your responsibility", color: "bg-warning/10 text-warning border-warning/30" },
  }[status];

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
          {meta.label}
        </Badge>
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-muted-foreground flex gap-2">
            <span className="text-muted-foreground/60 shrink-0">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocLink({ title, href }: { title: string; href?: string }) {
  return (
    <a
      href={href || "#"}
      target={href ? "_blank" : undefined}
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
        href ? "hover:border-primary/40 hover:bg-primary/5 cursor-pointer" : "opacity-60 cursor-not-allowed"
      }`}
      onClick={(e) => !href && e.preventDefault()}
    >
      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground">{title}</span>
    </a>
  );
}
