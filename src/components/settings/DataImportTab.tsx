import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Users, CalendarDays, Stethoscope, Receipt, Package, UserCog, Loader2, ClipboardCheck, FileDown } from "lucide-react";

interface DataImportTabProps { clinicId: string; }

const IMPORT_MODULES = [
  { key: "patients", label: "Patients", icon: Users, color: "bg-primary/10 text-primary",
    columns: ["full_name*", "phone", "email", "age", "gender", "blood_group", "address", "medical_history", "allergies", "notes"],
    requiredCols: ["full_name"],
    dbTable: "patients",
  },
  { key: "appointments", label: "Appointments", icon: CalendarDays, color: "bg-accent text-accent-foreground",
    columns: ["patient_name*", "patient_phone*", "appointment_date*", "appointment_time*", "type", "status", "duration_minutes", "notes"],
    requiredCols: ["patient_name", "patient_phone", "appointment_date", "appointment_time"],
    dbTable: "appointments",
  },
  { key: "treatments", label: "Treatments", icon: Stethoscope, color: "bg-success/10 text-success",
    columns: ["patient_name*", "patient_phone*", "tooth_number*", "treatment_name*", "cost", "status", "notes", "date"],
    requiredCols: ["patient_name", "patient_phone", "tooth_number", "treatment_name"],
    dbTable: "tooth_treatments",
  },
  { key: "invoices", label: "Invoices", icon: Receipt, color: "bg-warning/10 text-warning",
    columns: ["patient_name*", "patient_phone*", "invoice_number", "amount*", "paid_amount", "status", "payment_method", "invoice_date", "notes"],
    requiredCols: ["patient_name", "patient_phone", "amount"],
    dbTable: "invoices",
  },
  { key: "inventory", label: "Inventory", icon: Package, color: "bg-purple-100 text-purple-700",
    columns: ["name*", "category", "quantity", "unit", "unit_cost", "min_stock_level", "supplier", "expiry_date"],
    requiredCols: ["name"],
    dbTable: "inventory_items",
  },
  { key: "staff", label: "Staff", icon: UserCog, color: "bg-blue-100 text-blue-700",
    columns: ["full_name*", "role*", "phone", "email", "specialization"],
    requiredCols: ["full_name", "role"],
    dbTable: "profiles",
  },
  { key: "treatment_plans", label: "Treatment Plans", icon: ClipboardCheck, color: "bg-success/10 text-success",
    columns: ["patient_name*", "patient_phone*", "plan_name", "status", "total_estimated_cost", "notes"],
    requiredCols: ["patient_name", "patient_phone"],
    dbTable: "treatment_plans",
  },
];

function generateCSVTemplate(mod: typeof IMPORT_MODULES[0]) {
  const header = mod.columns.map(c => c.replace("*", "")).join(",");
  const sampleRow = mod.columns.map(c => {
    const col = c.replace("*", "");
    if (col === "full_name" || col === "patient_name") return "John Doe";
    if (col === "phone" || col === "patient_phone") return "+91 9876543210";
    if (col === "email") return "john@example.com";
    if (col === "age") return "35";
    if (col === "gender") return "Male";
    if (col === "appointment_date" || col === "invoice_date" || col === "date" || col === "expiry_date") return "2025-01-15";
    if (col === "appointment_time") return "10:00";
    if (col === "type") return "Checkup";
    if (col === "status") return "completed";
    if (col === "amount" || col === "cost" || col === "unit_cost") return "1000";
    if (col === "paid_amount") return "500";
    if (col === "quantity" || col === "min_stock_level") return "10";
    if (col === "tooth_number") return "21";
    if (col === "treatment_name") return "RCT";
    if (col === "role") return "doctor";
    if (col === "name") return "Dental Mirror";
    if (col === "category") return "Instruments";
    if (col === "unit") return "pcs";
    if (col === "plan_name") return "Comprehensive Treatment Plan";
    if (col === "total_estimated_cost") return "15000";
    return "";
  }).join(",");
  return `${header}\n${sampleRow}`;
}

function downloadTemplate(mod: typeof IMPORT_MODULES[0]) {
  const csv = generateCSVTemplate(mod);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${mod.key}_import_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAllTemplates() {
  IMPORT_MODULES.forEach((mod, i) => {
    setTimeout(() => downloadTemplate(mod), i * 300);
  });
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
  return { headers, rows };
}

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function DataImportTab({ clinicId }: DataImportTabProps) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mod = IMPORT_MODULES.find(m => m.key === selectedModule);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.rows.length === 0) {
        toast.error("File is empty or has no data rows");
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!preview || !mod) return;
    setImporting(true);
    let success = 0, failed = 0;
    const errors: string[] = [];

    for (const row of preview.rows) {
      try {
        if (mod.key === "patients") {
          if (!row.full_name) { failed++; errors.push(`Row missing full_name`); continue; }
          const { error } = await supabase.from("patients").insert({
            clinic_id: clinicId, full_name: row.full_name, phone: row.phone || null,
            email: row.email || null, age: row.age ? parseInt(row.age) : null,
            gender: row.gender || null, blood_group: row.blood_group || null,
            address: row.address || null, medical_history: row.medical_history || null,
            allergies: row.allergies || null, notes: row.notes || null,
          });
          if (error) { failed++; errors.push(`${row.full_name}: ${error.message}`); } else success++;
        } else if (mod.key === "inventory") {
          if (!row.name) { failed++; errors.push(`Row missing name`); continue; }
          const { error } = await supabase.from("inventory_items").insert({
            clinic_id: clinicId, name: row.name, category: row.category || null,
            quantity: row.quantity ? parseFloat(row.quantity) : 0,
            unit: row.unit || "pcs", unit_cost: row.unit_cost ? parseFloat(row.unit_cost) : 0,
            min_stock_level: row.min_stock_level ? parseFloat(row.min_stock_level) : 0,
            supplier: row.supplier || null, expiry_date: row.expiry_date || null,
          });
          if (error) { failed++; errors.push(`${row.name}: ${error.message}`); } else success++;
        } else if (mod.key === "appointments") {
          if (!row.patient_name || !row.appointment_date || !row.appointment_time) {
            failed++; errors.push(`Row missing required fields`); continue;
          }
          // Find or create patient
          let patientId: string | null = null;
          if (row.patient_phone) {
            const { data: existing } = await supabase.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", row.patient_phone).maybeSingle();
            patientId = existing?.id || null;
          }
          if (!patientId) {
            const { data: created } = await supabase.from("patients").insert({ clinic_id: clinicId, full_name: row.patient_name, phone: row.patient_phone || null }).select("id").single();
            patientId = created?.id || null;
          }
          if (!patientId) { failed++; errors.push(`Could not resolve patient: ${row.patient_name}`); continue; }
          const { error } = await supabase.from("appointments").insert({
            clinic_id: clinicId, patient_id: patientId,
            appointment_date: row.appointment_date, appointment_time: row.appointment_time,
            type: row.type || "checkup", status: row.status || "completed",
            duration_minutes: row.duration_minutes ? parseInt(row.duration_minutes) : 30,
            notes: row.notes || null,
          });
          if (error) { failed++; errors.push(`${row.patient_name}: ${error.message}`); } else success++;
        } else if (mod.key === "invoices") {
          if (!row.patient_name || !row.amount) { failed++; errors.push(`Row missing required fields`); continue; }
          let patientId: string | null = null;
          if (row.patient_phone) {
            const { data: existing } = await supabase.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", row.patient_phone).maybeSingle();
            patientId = existing?.id || null;
          }
          if (!patientId) {
            const { data: created } = await supabase.from("patients").insert({ clinic_id: clinicId, full_name: row.patient_name, phone: row.patient_phone || null }).select("id").single();
            patientId = created?.id || null;
          }
          if (!patientId) { failed++; errors.push(`Could not resolve patient: ${row.patient_name}`); continue; }
          const amt = parseFloat(row.amount) || 0;
          const paid = parseFloat(row.paid_amount) || 0;
          const { error } = await supabase.from("invoices").insert({
            clinic_id: clinicId, patient_id: patientId, amount: amt, total: amt,
            paid_amount: paid, status: paid >= amt ? "paid" : paid > 0 ? "partial" : "unpaid",
            payment_method: row.payment_method || null,
            invoice_date: row.invoice_date || new Date().toISOString().split("T")[0],
            notes: row.notes || null, invoice_number: row.invoice_number || null,
          });
          if (error) { failed++; errors.push(`${row.patient_name}: ${error.message}`); } else success++;
        } else if (mod.key === "treatments") {
          if (!row.patient_name || !row.tooth_number || !row.treatment_name) { failed++; errors.push(`Row missing required fields`); continue; }
          let patientId: string | null = null;
          if (row.patient_phone) {
            const { data: existing } = await supabase.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", row.patient_phone).maybeSingle();
            patientId = existing?.id || null;
          }
          if (!patientId) {
            const { data: created } = await supabase.from("patients").insert({ clinic_id: clinicId, full_name: row.patient_name, phone: row.patient_phone || null }).select("id").single();
            patientId = created?.id || null;
          }
          if (!patientId) { failed++; errors.push(`Could not resolve patient: ${row.patient_name}`); continue; }
          // Find or create tooth record
          const toothNum = parseInt(row.tooth_number);
          let toothRecordId: string | null = null;
          const { data: existingTooth } = await (supabase as any).from("tooth_records").select("id").eq("patient_id", patientId).eq("tooth_number", toothNum).maybeSingle();
          if (existingTooth?.id) {
            toothRecordId = existingTooth.id;
          } else {
            const { data: createdTooth } = await (supabase as any).from("tooth_records").insert({ patient_id: patientId, tooth_number: toothNum, clinic_id: clinicId }).select("id").single();
            toothRecordId = createdTooth?.id || null;
          }
          if (!toothRecordId) { failed++; errors.push(`Could not create tooth record for ${row.patient_name}`); continue; }
          const { error } = await (supabase as any).from("tooth_treatments").insert({
            tooth_record_id: toothRecordId, treatment_name: row.treatment_name,
            cost: row.cost ? parseFloat(row.cost) : 0, status: row.status || "completed",
            notes: row.notes || null,
          });
          if (error) { failed++; errors.push(`${row.patient_name} T#${toothNum}: ${error.message}`); } else success++;
        } else if (mod.key === "staff") {
          if (!row.full_name || !row.role) { failed++; errors.push(`Row missing required fields`); continue; }
          const { error } = await supabase.from("profiles").insert({
            clinic_id: clinicId, full_name: row.full_name, role: row.role,
            phone: row.phone || null, specialization: row.specialization || null,
            user_id: crypto.randomUUID(),
          } as any);
          if (error) { failed++; errors.push(`${row.full_name}: ${error.message}`); } else success++;
        } else if (mod.key === "treatment_plans") {
          if (!row.patient_name) { failed++; errors.push(`Row missing patient_name`); continue; }
          let patientId: string | null = null;
          if (row.patient_phone) {
            const { data: existing } = await supabase.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", row.patient_phone).maybeSingle();
            patientId = existing?.id || null;
          }
          if (!patientId) {
            const { data: created } = await supabase.from("patients").insert({ clinic_id: clinicId, full_name: row.patient_name, phone: row.patient_phone || null }).select("id").single();
            patientId = created?.id || null;
          }
          if (!patientId) { failed++; errors.push(`Could not resolve patient: ${row.patient_name}`); continue; }
          const { error } = await supabase.from("treatment_plans").insert({
            clinic_id: clinicId, patient_id: patientId,
            plan_name: row.plan_name || "Treatment Plan",
            status: row.status || "draft",
            total_estimated_cost: row.total_estimated_cost ? parseFloat(row.total_estimated_cost) : 0,
            notes: row.notes || null,
          });
          if (error) { failed++; errors.push(`${row.patient_name}: ${error.message}`); } else success++;
        }
      } catch (err: any) {
        failed++;
        errors.push(err.message);
      }
    }

    setImportResult({ success, failed, errors });
    setImporting(false);
    if (success > 0) toast.success(`${success} records imported successfully!`);
    if (failed > 0) toast.error(`${failed} records failed to import`);
  };

  return (
    <div className="space-y-6">
      {/* Download Templates */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Download Import Templates
          </CardTitle>
          <CardDescription>Download pre-formatted CSV templates, fill in your data, and upload them back</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {IMPORT_MODULES.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => downloadTemplate(m)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left">
                  <div className={`h-9 w-9 rounded-lg ${m.color} flex items-center justify-center shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.columns.length} fields</p>
                  </div>
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={downloadAllTemplates}>
            <Download className="h-3.5 w-3.5" /> Download All Templates
          </Button>
        </CardContent>
      </Card>

      {/* Upload & Import */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Upload & Import Data
          </CardTitle>
          <CardDescription>Select the data type, upload your CSV file, preview and confirm import</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedModule || ""} onValueChange={v => { setSelectedModule(v); setPreview(null); setImportResult(null); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select data type" /></SelectTrigger>
              <SelectContent>
                {IMPORT_MODULES.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!selectedModule} className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Choose CSV File
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </div>

          {mod && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <p className="font-medium text-sm">Required columns for {mod.label}:</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.columns.map(c => (
                  <Badge key={c} variant={c.includes("*") ? "default" : "secondary"} className="text-[10px]">
                    {c.replace("*", "")} {c.includes("*") && <span className="text-destructive ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{preview.rows.length} rows found</p>
                <Button onClick={handleImport} disabled={importing} className="gap-1.5">
                  {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing...</> : <><Upload className="h-3.5 w-3.5" /> Import {preview.rows.length} Records</>}
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>{preview.headers.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {preview.headers.map(h => <TableCell key={h} className="text-xs py-1.5">{row[h] || "-"}</TableCell>)}
                      </TableRow>
                    ))}
                    {preview.rows.length > 10 && (
                      <TableRow><TableCell colSpan={preview.headers.length} className="text-center text-xs text-muted-foreground py-2">
                        ...and {preview.rows.length - 10} more rows
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                {importResult.success > 0 && (
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{importResult.success} imported</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{importResult.failed} failed</span>
                  </div>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-destructive/5 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Guide */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">📋 Migration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Step 1: Export from your old system</p>
              <p>Export your data from your current software as CSV or Excel files. Most dental software supports data export.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Step 2: Map to our templates</p>
              <p>Download our templates above and copy your data into the matching columns. Fields marked with * are required.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Step 3: Import in order</p>
              <p>Import data in this order: <strong>Patients → Staff → Appointments → Treatments → Invoices → Inventory</strong></p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Step 4: Verify your data</p>
              <p>After import, check your Patients, Appointments, and Billing pages to ensure everything looks correct.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
