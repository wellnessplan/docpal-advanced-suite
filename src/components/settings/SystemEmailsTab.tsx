import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Eye, AlertTriangle, Send, Inbox } from "lucide-react";
import { previewSystemEmail, SystemEmailTemplate } from "@/lib/system-emails";
import { format } from "date-fns";

const TEMPLATES: { key: SystemEmailTemplate; label: string; sample: any }[] = [
  { key: "welcome", label: "Welcome email", sample: { recipient_name: "Dr. Sharma", clinic_name: "Smile Dental" } },
  { key: "password_reset", label: "Password reset", sample: { recipient_name: "Dr. Sharma" } },
  { key: "trial_expiring", label: "Trial expiring (3 days)", sample: { recipient_name: "Dr. Sharma", clinic_name: "Smile Dental", days_left: 3 } },
  { key: "trial_expired", label: "Trial expired", sample: { recipient_name: "Dr. Sharma", clinic_name: "Smile Dental" } },
  { key: "invoice_created", label: "New invoice", sample: { recipient_name: "Mrs. Patel", clinic_name: "Smile Dental", invoice_number: "INV-00042", total: 4500 } },
  { key: "invoice_payment_received", label: "Payment received", sample: { recipient_name: "Mrs. Patel", invoice_number: "INV-00042", amount: 4500, clinic_name: "Smile Dental" } },
  { key: "appointment_reminder", label: "Appointment reminder", sample: { recipient_name: "Mr. Khan", clinic_name: "Smile Dental", appointment_date: "Tomorrow", appointment_time: "10:30 AM" } },
];

export default function SystemEmailsTab() {
  const { clinicId } = useAuth();
  const [previewKey, setPreviewKey] = useState<SystemEmailTemplate | null>(null);

  const { data: queue = [] } = useQuery({
    queryKey: ["outgoing-emails", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase
        .from("outgoing_emails" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: !!clinicId,
  });

  const preview = previewKey ? previewSystemEmail(previewKey, TEMPLATES.find((t) => t.key === previewKey)?.sample) : null;
  const pending = queue.filter((q) => q.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          System Emails
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Branded transactional emails for welcome, password reset, trial expiry, and billing.
        </p>
      </div>

      <Alert className="border-warning/30 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-sm">Sender domain not configured</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          Emails are queued below but not yet delivered. To start sending, connect a custom email domain
          (e.g. <code>notify.yourclinic.com</code>) in Lovable Cloud → Emails. Until then, the queue acts as a preview
          of what would be sent.
        </AlertDescription>
      </Alert>

      {/* Templates */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="font-heading text-base">Email templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => setPreviewKey(t.key)}
              className="flex items-center justify-between gap-2 rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.key}</p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Queue */}
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Email queue
            {pending > 0 && <Badge variant="outline" className="text-[10px]">{pending} pending</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No emails sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Template</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Recipient</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">When</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((e: any) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{e.template_key}</td>
                      <td className="px-4 py-3 text-foreground">{e.recipient_email}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{e.subject}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${statusColor(e.status)}`}>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "MMM d, h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewKey} onOpenChange={(o) => !o && setPreviewKey(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Preview: {preview?.subject}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border bg-muted/30">
            {preview && <iframe srcDoc={preview.html} className="w-full h-full min-h-[500px] bg-white" title="email preview" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "sent": return "border-success/40 text-success bg-success/5";
    case "pending": return "border-warning/40 text-warning bg-warning/5";
    case "failed": return "border-destructive/40 text-destructive bg-destructive/5";
    default: return "";
  }
}
