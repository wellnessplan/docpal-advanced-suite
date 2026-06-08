import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, TrendingUp, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ClinicPulse — a single horizontal "heartbeat" strip showing live clinic activity.
 * 24 bars across the working day (8am–8pm, half-hour buckets) with intensity scaled to events.
 * Color shifts: green=flowing, amber=bottleneck (queue waiting), red=stalled revenue.
 */
export default function ClinicPulse() {
  const { clinicId } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const { data: appts = [] } = useQuery({
    queryKey: ["pulse-appts", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("appointment_time, status, created_at")
        .eq("clinic_id", clinicId!).eq("appointment_date", today);
      return data ?? [];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["pulse-invoices", clinicId, today],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("paid_amount, total, status, created_at, paid_at")
        .eq("clinic_id", clinicId!)
        .gte("created_at", today + "T00:00:00");
      return data ?? [];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  // Build 24 half-hour buckets from 8:00 to 20:00
  const bars = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    const toBucket = (hh: number, mm: number) => {
      const idx = (hh - 8) * 2 + (mm >= 30 ? 1 : 0);
      return idx >= 0 && idx < 24 ? idx : -1;
    };
    appts.forEach((a: any) => {
      if (!a.appointment_time) return;
      const [h, m] = a.appointment_time.split(":").map(Number);
      const b = toBucket(h, m);
      if (b >= 0) buckets[b] += a.status === "completed" ? 1.5 : 1;
    });
    invoices.forEach((i: any) => {
      const ts = new Date(i.paid_at || i.created_at);
      const b = toBucket(ts.getHours(), ts.getMinutes());
      if (b >= 0) buckets[b] += 1.2;
    });
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => v / max);
  }, [appts, invoices]);

  const checkIns = appts.filter((a: any) => a.status === "in_progress" || a.status === "completed").length;
  const waiting = appts.filter((a: any) => a.status === "scheduled" || a.status === "confirmed").length;
  const revenue = invoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
  const stalled = waiting > 3 && revenue === 0;
  const bottleneck = waiting >= 5;
  const flowColor = stalled ? "destructive" : bottleneck ? "warning" : "success";

  const now = new Date();
  const nowBucket = (now.getHours() - 8) * 2 + (now.getMinutes() >= 30 ? 1 : 0);

  const accentClass = {
    success: "from-success/80 to-success",
    warning: "from-warning/80 to-warning",
    destructive: "from-destructive/80 to-destructive",
  }[flowColor];

  const dotClass = {
    success: "bg-success shadow-[0_0_12px_hsl(var(--success))]",
    warning: "bg-warning shadow-[0_0_12px_hsl(var(--warning))]",
    destructive: "bg-destructive shadow-[0_0_12px_hsl(var(--destructive))]",
  }[flowColor];

  const label = stalled ? "Revenue stalled" : bottleneck ? "Queue forming" : "Flowing";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-4 md:p-5 shadow-card">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className={cn("absolute inset-0 rounded-full animate-ping opacity-60", dotClass)} />
            <span className={cn("relative block h-2.5 w-2.5 rounded-full", dotClass)} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground leading-tight">Clinic Pulse</p>
            <p className="text-xs text-muted-foreground">{label} · live</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Stat icon={Users} label="Check-ins" value={checkIns} />
          <Stat icon={Activity} label="Waiting" value={waiting} accent={bottleneck ? "text-warning" : undefined} />
          <Stat icon={Wallet} label="Collected" value={`₹${revenue.toLocaleString("en-IN")}`} />
          <Stat icon={TrendingUp} label="Appts" value={appts.length} />
        </div>
      </div>

      {/* Waveform */}
      <div className="mt-3 flex items-end gap-[3px] h-12 md:h-14">
        {bars.map((v, i) => {
          const isPast = i < nowBucket;
          const isNow = i === nowBucket;
          const height = Math.max(0.06, v) * 100;
          return (
            <div key={i} className="flex-1 flex items-end h-full">
              <div
                className={cn(
                  "w-full rounded-sm transition-all duration-700 bg-gradient-to-t",
                  isPast ? accentClass : "from-muted to-muted/60",
                  isNow && "ring-1 ring-primary"
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>8a</span><span>12p</span><span>4p</span><span>8p</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", accent ?? "text-muted-foreground")} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums", accent ?? "text-foreground")}>{value}</span>
    </div>
  );
}
