import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Pause, Play, BellOff, BellRing } from "lucide-react";

interface MyEnrollment {
  enrollment_id: string; program_name: string; emoji: string | null;
  interval_months: number; status: string;
  pause_until: string | null; opted_out_at: string | null;
  next_reminder_at: string;
}

export default function PublicManagePrograms() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MyEnrollment[] | null>(null);

  const lookup = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Enter your 10-digit number");
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("get_my_program_enrollments", {
      p_clinic_id: clinicId, p_phone: digits,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as MyEnrollment[]);
  };

  const act = async (id: string, action: string) => {
    const digits = phone.replace(/\D/g, "");
    const { error } = await (supabase.rpc as any)("update_my_program_enrollment", {
      p_clinic_id: clinicId, p_phone: digits, p_enrollment_id: id, p_action: action,
    });
    if (error) return toast.error(error.message);
    toast.success("Updated");
    lookup();
  };

  const statusBadge = (e: MyEnrollment) => {
    if (e.opted_out_at) return <Badge variant="destructive">Opted out</Badge>;
    if (e.pause_until && new Date(e.pause_until) > new Date())
      return <Badge variant="secondary">Paused until {new Date(e.pause_until).toLocaleDateString()}</Badge>;
    return <Badge>Active</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Manage your reminders</h1>
          <p className="text-muted-foreground text-sm">Pause, resume or stop your program subscriptions.</p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Your WhatsApp number</Label>
              <Input value={phone} inputMode="numeric"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile" />
            </div>
            <Button className="w-full" onClick={lookup} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Look up my subscriptions
            </Button>
          </CardContent>
        </Card>

        {rows && rows.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No subscriptions found for this number.</CardContent></Card>
        )}

        {rows && rows.map((e) => {
          const paused = !!(e.pause_until && new Date(e.pause_until) > new Date());
          const stopped = !!e.opted_out_at;
          return (
            <Card key={e.enrollment_id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{e.emoji ?? "🦷"}</span>
                    <div>
                      <div className="font-semibold">{e.program_name}</div>
                      <div className="text-xs text-muted-foreground">Every {e.interval_months} month{e.interval_months > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  {statusBadge(e)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {stopped ? (
                    <Button size="sm" onClick={() => act(e.enrollment_id, "resubscribe")}>
                      <BellRing className="h-4 w-4 mr-1" />Resubscribe
                    </Button>
                  ) : paused ? (
                    <Button size="sm" onClick={() => act(e.enrollment_id, "resume")}>
                      <Play className="h-4 w-4 mr-1" />Resume now
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act(e.enrollment_id, "pause_1m")}>
                        <Pause className="h-4 w-4 mr-1" />Pause 1 month
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(e.enrollment_id, "pause_3m")}>
                        <Pause className="h-4 w-4 mr-1" />Pause 3 months
                      </Button>
                    </>
                  )}
                  {!stopped && (
                    <Button size="sm" variant="destructive" onClick={() => act(e.enrollment_id, "opt_out")}>
                      <BellOff className="h-4 w-4 mr-1" />Stop reminders
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
