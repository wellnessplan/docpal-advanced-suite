import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Save, Coffee } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayRow {
  day_of_week: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
}

const defaultRow = (dow: number): DayRow => ({
  day_of_week: dow,
  is_closed: dow === 0, // Sunday closed by default
  open_time: "09:00",
  close_time: "18:00",
  break_start: "13:00",
  break_end: "14:00",
  slot_duration_minutes: 30,
});

export default function WorkingHoursPerDayTab({ clinicId }: { clinicId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DayRow[]>(Array.from({ length: 7 }, (_, i) => defaultRow(i)));

  const { data } = useQuery({
    queryKey: ["clinic-working-hours", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clinic_working_hours")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("day_of_week");
      return data as DayRow[] | null;
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (data && data.length) {
      const map = new Map(data.map((d) => [d.day_of_week, d]));
      setRows(Array.from({ length: 7 }, (_, i) => map.get(i) || defaultRow(i)));
    }
  }, [data]);

  const update = (i: number, patch: Partial<DayRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = useMutation({
    mutationFn: async () => {
      // Upsert all 7 rows
      const payload = rows.map((r) => ({
        clinic_id: clinicId,
        day_of_week: r.day_of_week,
        is_closed: r.is_closed,
        open_time: r.open_time,
        close_time: r.close_time,
        break_start: r.break_start || null,
        break_end: r.break_end || null,
        slot_duration_minutes: r.slot_duration_minutes,
      }));
      const { error } = await (supabase as any)
        .from("clinic_working_hours")
        .upsert(payload, { onConflict: "clinic_id,day_of_week" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-working-hours"] });
      toast.success("Working hours saved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Clock className="h-5 w-5 text-primary" /> Working Hours (per day)
        </CardTitle>
        <CardDescription>
          Configure open/close times, lunch break, and appointment slot duration for each day.
          The QR registration page only shows slots within these hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.day_of_week} className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!r.is_closed}
                  onCheckedChange={(v) => update(i, { is_closed: !v })}
                />
                <span className={`font-semibold text-sm w-24 ${r.is_closed ? "text-muted-foreground line-through" : ""}`}>
                  {DAYS[r.day_of_week]}
                </span>
              </div>
              {!r.is_closed && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Slot:</Label>
                  <Select
                    value={String(r.slot_duration_minutes)}
                    onValueChange={(v) => update(i, { slot_duration_minutes: parseInt(v) })}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!r.is_closed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Open</Label>
                  <Input type="time" value={r.open_time} onChange={(e) => update(i, { open_time: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Close</Label>
                  <Input type="time" value={r.close_time} onChange={(e) => update(i, { close_time: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Coffee className="h-3 w-3" /> Break Start</Label>
                  <Input type="time" value={r.break_start ?? ""} onChange={(e) => update(i, { break_start: e.target.value || null })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Break End</Label>
                  <Input type="time" value={r.break_end ?? ""} onChange={(e) => update(i, { break_end: e.target.value || null })} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
        ))}
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-2">
          <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Saving…" : "Save Working Hours"}
        </Button>
      </CardContent>
    </Card>
  );
}
