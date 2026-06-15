import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Loader2 } from "lucide-react";

interface Program { id: string; name: string; emoji: string | null; }
interface Row { full_name: string; phone: string; raw?: any; valid: boolean; }

export default function BulkEnrollDialog({ program, open, onOpenChange }: {
  program: Program; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { clinicId } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
    const parsed: Row[] = json.map((r) => {
      const name = String(r.full_name ?? r.name ?? r.Name ?? r["Full Name"] ?? "").trim();
      const phoneRaw = String(r.phone ?? r.Phone ?? r.mobile ?? r.Mobile ?? r.whatsapp ?? "").replace(/\D/g, "");
      return { full_name: name, phone: phoneRaw, raw: r, valid: !!name && phoneRaw.length >= 10 };
    });
    setRows(parsed);
  };

  const upload = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => r.valid).map((r) => ({ full_name: r.full_name, phone: r.phone }));
      if (valid.length === 0) throw new Error("No valid rows");
      const { data, error } = await (supabase.rpc as any)("bulk_enroll_program", {
        p_program_id: program.id, p_rows: valid,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`${d.added} enrolled · ${d.skipped} skipped`);
      qc.invalidateQueries({ queryKey: ["program_enrollments", clinicId] });
      onOpenChange(false);
      setRows([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { full_name: "Jane Doe", phone: "9876543210" },
      { full_name: "John Smith", phone: "9123456789" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Enrollments");
    XLSX.writeFile(wb, `${program.name.replace(/\s+/g, "-")}-template.xlsx`);
  };

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{program.emoji} Bulk enroll · {program.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />Download template
            </Button>
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />Upload CSV / Excel
            </Button>
            <input
              ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Required columns: <code>full_name</code>, <code>phone</code>. Phone numbers with fewer than 10 digits are skipped.
          </p>

          {rows.length > 0 && (
            <>
              <div className="text-sm">
                <Badge>{validCount} valid</Badge>{" "}
                <Badge variant="outline">{rows.length - validCount} skipped</Badge>
              </div>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Phone</th><th className="p-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{r.full_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-2 font-mono">{r.phone || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-2 text-center">
                          {r.valid ? <Badge variant="secondary">OK</Badge> : <Badge variant="destructive">Skip</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <div className="text-center p-2 text-xs text-muted-foreground">+ {rows.length - 50} more rows</div>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = ""; }}>Clear</Button>
                <Button onClick={() => upload.mutate()} disabled={upload.isPending || validCount === 0}>
                  {upload.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Enroll {validCount} patient{validCount === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
