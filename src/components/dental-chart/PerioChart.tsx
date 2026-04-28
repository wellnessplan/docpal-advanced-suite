import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, Plus, Save, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props { patientId: string; clinicId: string; }

const ADULT_TEETH = [
  18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,
  48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38,
];

const SITES_BUCCAL = ["pd_db", "pd_b", "pd_mb"] as const;
const SITES_LINGUAL = ["pd_dl", "pd_l", "pd_ml"] as const;
const BOP_BUCCAL = ["bop_db", "bop_b", "bop_mb"] as const;
const BOP_LINGUAL = ["bop_dl", "bop_l", "bop_ml"] as const;

type PerioRow = {
  tooth_number: number;
  pd_db?: number; pd_b?: number; pd_mb?: number;
  pd_dl?: number; pd_l?: number; pd_ml?: number;
  recession_b?: number; recession_l?: number;
  bop_db?: boolean; bop_b?: boolean; bop_mb?: boolean;
  bop_dl?: boolean; bop_l?: boolean; bop_ml?: boolean;
  mobility?: number; furcation?: number; plaque?: boolean;
  notes?: string;
};

export default function PerioChart({ patientId, clinicId }: Props) {
  const qc = useQueryClient();
  const [chartDate, setChartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<Record<number, PerioRow>>({});

  const { data: existing = [] } = useQuery({
    queryKey: ["perio", patientId, chartDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("perio_charts" as any)
        .select("*")
        .eq("patient_id", patientId)
        .eq("chart_date", chartDate);
      return (data ?? []) as any[];
    },
  });

  // Hydrate state from db
  useMemo(() => {
    const map: Record<number, PerioRow> = {};
    existing.forEach((r: any) => { map[r.tooth_number] = r; });
    setRows(map);
  }, [existing]);

  // Past chart dates (for history selector)
  const { data: historyDates = [] } = useQuery({
    queryKey: ["perio-dates", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("perio_charts" as any)
        .select("chart_date")
        .eq("patient_id", patientId);
      const uniq = Array.from(new Set((data ?? []).map((d: any) => d.chart_date))).sort().reverse();
      return uniq as string[];
    },
  });

  const update = (tooth: number, field: keyof PerioRow, value: any) => {
    setRows(r => ({ ...r, [tooth]: { ...(r[tooth] || { tooth_number: tooth }), tooth_number: tooth, [field]: value } }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const records = Object.values(rows).filter(r => r.tooth_number);
      if (!records.length) throw new Error("Nothing to save");
      const payload = records.map(r => ({
        clinic_id: clinicId, patient_id: patientId,
        chart_date: chartDate, tooth_number: r.tooth_number,
        pd_db: r.pd_db ?? null, pd_b: r.pd_b ?? null, pd_mb: r.pd_mb ?? null,
        pd_dl: r.pd_dl ?? null, pd_l: r.pd_l ?? null, pd_ml: r.pd_ml ?? null,
        recession_b: r.recession_b ?? null, recession_l: r.recession_l ?? null,
        bop_db: !!r.bop_db, bop_b: !!r.bop_b, bop_mb: !!r.bop_mb,
        bop_dl: !!r.bop_dl, bop_l: !!r.bop_l, bop_ml: !!r.bop_ml,
        mobility: r.mobility ?? null, furcation: r.furcation ?? null,
        plaque: !!r.plaque, notes: r.notes ?? null,
      }));
      const { error } = await (supabase as any)
        .from("perio_charts")
        .upsert(payload, { onConflict: "patient_id,chart_date,tooth_number" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perio"] });
      qc.invalidateQueries({ queryKey: ["perio-dates"] });
      toast.success("Perio chart saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Stats
  const stats = useMemo(() => {
    const all = Object.values(rows);
    let bopCount = 0, bopTotal = 0, deepPockets = 0, mobile = 0;
    all.forEach(r => {
      [...BOP_BUCCAL, ...BOP_LINGUAL].forEach(k => { bopTotal++; if ((r as any)[k]) bopCount++; });
      [...SITES_BUCCAL, ...SITES_LINGUAL].forEach(k => { if (((r as any)[k] ?? 0) >= 5) deepPockets++; });
      if ((r.mobility ?? 0) > 0) mobile++;
    });
    return {
      bopPct: bopTotal ? Math.round((bopCount / bopTotal) * 100) : 0,
      deepPockets, mobile,
    };
  }, [rows]);

  const colorPD = (v?: number) => {
    if (!v) return "";
    if (v <= 3) return "bg-success/10 text-success";
    if (v <= 5) return "bg-warning/10 text-warning";
    return "bg-destructive/15 text-destructive font-bold";
  };

  const renderToothRow = (tooth: number) => {
    const r = rows[tooth] || { tooth_number: tooth };
    return (
      <tr key={tooth} className="border-b hover:bg-muted/30 transition-colors">
        <td className="px-2 py-1 text-xs font-bold text-center bg-muted/20 sticky left-0">{tooth}</td>
        {SITES_BUCCAL.map(s => (
          <td key={s} className="p-0.5">
            <Input type="number" min="0" max="15" value={(r as any)[s] ?? ""} onChange={e => update(tooth, s, e.target.value ? +e.target.value : undefined)}
              className={cn("h-7 w-10 text-xs text-center px-1", colorPD((r as any)[s]))} />
          </td>
        ))}
        {BOP_BUCCAL.map(s => (
          <td key={s} className="p-0.5 text-center">
            <input type="checkbox" checked={!!(r as any)[s]} onChange={e => update(tooth, s, e.target.checked)} className="accent-destructive h-3.5 w-3.5" />
          </td>
        ))}
        <td className="p-0.5"><Input type="number" min="0" max="15" value={r.recession_b ?? ""} onChange={e => update(tooth, "recession_b", e.target.value ? +e.target.value : undefined)} className="h-7 w-10 text-xs text-center px-1" /></td>
        <td className="p-0.5">
          <Select value={r.mobility?.toString() ?? ""} onValueChange={v => update(tooth, "mobility", v ? +v : undefined)}>
            <SelectTrigger className="h-7 w-12 text-xs px-1"><SelectValue placeholder="-" /></SelectTrigger>
            <SelectContent>{[0,1,2,3].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="p-0.5">
          <Select value={r.furcation?.toString() ?? ""} onValueChange={v => update(tooth, "furcation", v ? +v : undefined)}>
            <SelectTrigger className="h-7 w-12 text-xs px-1"><SelectValue placeholder="-" /></SelectTrigger>
            <SelectContent>{[0,1,2,3].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        {SITES_LINGUAL.map(s => (
          <td key={s} className="p-0.5">
            <Input type="number" min="0" max="15" value={(r as any)[s] ?? ""} onChange={e => update(tooth, s, e.target.value ? +e.target.value : undefined)}
              className={cn("h-7 w-10 text-xs text-center px-1", colorPD((r as any)[s]))} />
          </td>
        ))}
        {BOP_LINGUAL.map(s => (
          <td key={s} className="p-0.5 text-center">
            <input type="checkbox" checked={!!(r as any)[s]} onChange={e => update(tooth, s, e.target.checked)} className="accent-destructive h-3.5 w-3.5" />
          </td>
        ))}
        <td className="p-0.5"><Input type="number" min="0" max="15" value={r.recession_l ?? ""} onChange={e => update(tooth, "recession_l", e.target.value ? +e.target.value : undefined)} className="h-7 w-10 text-xs text-center px-1" /></td>
      </tr>
    );
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Periodontal Chart
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={chartDate} onValueChange={setChartDate}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={format(new Date(), "yyyy-MM-dd")}>Today (new)</SelectItem>
                {historyDates.filter(d => d !== format(new Date(), "yyyy-MM-dd")).map(d => (
                  <SelectItem key={d} value={d}>{format(new Date(d + "T00:00:00"), "dd MMM yyyy")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> {saveMut.isPending ? "Saving..." : "Save Chart"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className={cn("text-xs", stats.bopPct > 20 && "border-destructive text-destructive")}>
            BOP {stats.bopPct}%
          </Badge>
          <Badge variant="outline" className={cn("text-xs", stats.deepPockets > 0 && "border-destructive text-destructive")}>
            ≥5mm pockets: {stats.deepPockets}
          </Badge>
          <Badge variant="outline" className={cn("text-xs", stats.mobile > 0 && "border-warning text-warning")}>
            Mobile teeth: {stats.mobile}
          </Badge>
          {(stats.bopPct > 20 || stats.deepPockets > 5) && (
            <Badge className="bg-destructive/10 text-destructive border-destructive text-xs gap-1">
              <AlertCircle className="h-3 w-3" /> Active periodontitis
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="text-[10px] w-full">
            <thead className="bg-muted/40 sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="px-2 py-1 sticky left-0 bg-muted/40">Tooth</th>
                <th colSpan={3} className="px-2 py-1 border-l">Buccal PD (mm)</th>
                <th colSpan={3} className="px-2 py-1 border-l">Buccal BOP</th>
                <th rowSpan={2} className="px-2 py-1 border-l">Rec B</th>
                <th rowSpan={2} className="px-2 py-1 border-l">Mob</th>
                <th rowSpan={2} className="px-2 py-1 border-l">Furc</th>
                <th colSpan={3} className="px-2 py-1 border-l">Lingual PD (mm)</th>
                <th colSpan={3} className="px-2 py-1 border-l">Lingual BOP</th>
                <th rowSpan={2} className="px-2 py-1 border-l">Rec L</th>
              </tr>
              <tr>
                <th className="px-1">DB</th><th className="px-1">B</th><th className="px-1">MB</th>
                <th className="px-1 border-l">DB</th><th className="px-1">B</th><th className="px-1">MB</th>
                <th className="px-1 border-l">DL</th><th className="px-1">L</th><th className="px-1">ML</th>
                <th className="px-1 border-l">DL</th><th className="px-1">L</th><th className="px-1">ML</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={16} className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-2 py-1 uppercase">Upper</td></tr>
              {ADULT_TEETH.slice(0, 16).map(renderToothRow)}
              <tr><td colSpan={16} className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-2 py-1 uppercase">Lower</td></tr>
              {ADULT_TEETH.slice(16).map(renderToothRow)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
