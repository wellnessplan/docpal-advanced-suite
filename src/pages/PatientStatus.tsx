import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Check, Clock, MessageCircle, X } from "lucide-react";

type Row = {
  template_name: string;
  status: string;
  delivery_status: string | null;
  sent_at: string;
};

const ICON: Record<string, JSX.Element> = {
  queued: <Clock className="h-4 w-4" />,
  sent: <Check className="h-4 w-4" />,
  delivered: <CheckCheck className="h-4 w-4" />,
  read: <CheckCheck className="h-4 w-4 text-violet-600" />,
  failed: <X className="h-4 w-4 text-destructive" />,
};

export default function PatientStatus() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic") ?? "";
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !phone.trim()) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await (supabase as any).rpc("lookup_registration_status", {
      p_clinic_id: clinicId,
      p_phone: phone.trim(),
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" /> Message Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!clinicId ? (
            <p className="text-sm text-destructive">Open this page from your clinic's link.</p>
          ) : (
            <form onSubmit={lookup} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Your phone number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                  inputMode="tel"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking..." : "Check status"}
              </Button>
            </form>
          )}

          {err && <p className="text-xs text-destructive">{err}</p>}

          {rows && (
            <div className="space-y-2 pt-2 border-t">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No registration messages found for this number.
                </p>
              ) : (
                rows.map((r, i) => {
                  const v = (r.delivery_status ?? r.status ?? "queued").toLowerCase();
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        {ICON[v] ?? ICON.queued}
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {r.template_name.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.sent_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{v}</Badge>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
