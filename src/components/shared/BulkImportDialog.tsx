import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Download, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

export interface BulkImportColumn {
  /** field key used in the parsed row object */
  key: string;
  /** column header shown in template */
  header: string;
  /** is this column required? */
  required?: boolean;
  /** parse helper (defaults to string) */
  parse?: (raw: string) => any;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  columns: BulkImportColumn[];
  /** Called once the user has pasted/uploaded data and clicked Import.
   *  Receives an array of parsed row objects keyed by column.key. */
  onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped?: number } | void>;
  templateFileName?: string;
}

/** Splits a single CSV line accounting for quoted fields with commas. */
function parseCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export default function BulkImportDialog({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  templateFileName = "template.csv",
}: Props) {
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => setPasted("");

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.header).join(",");
    const blob = new Blob([headers + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseText = (text: string): Record<string, any>[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    // detect delimiter — tab if any line contains a tab, else comma
    const delimiter = lines[0].includes("\t") ? "\t" : ",";

    // detect header row by checking if first row contains any known header
    const firstCells = parseCsvLine(lines[0], delimiter).map((c) => c.toLowerCase());
    const headers = columns.map((c) => c.header.toLowerCase());
    const hasHeader = firstCells.some((c) => headers.includes(c));

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const colOrder = hasHeader
      ? firstCells.map((c) => columns.find((col) => col.header.toLowerCase() === c)?.key ?? null)
      : columns.map((c) => c.key);

    const rows: Record<string, any>[] = [];
    for (const line of dataLines) {
      const cells = parseCsvLine(line, delimiter);
      const row: Record<string, any> = {};
      cells.forEach((cell, idx) => {
        const key = colOrder[idx];
        if (!key) return;
        const def = columns.find((c) => c.key === key);
        const parsed = def?.parse ? def.parse(cell) : cell;
        row[key] = parsed === "" ? null : parsed;
      });
      // skip rows missing required fields
      const missingRequired = columns.some((c) => c.required && (row[c.key] === null || row[c.key] === undefined || row[c.key] === ""));
      if (!missingRequired) rows.push(row);
    }
    return rows;
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setPasted(text);
  };

  const runImport = async (text: string) => {
    const rows = parseText(text);
    if (!rows.length) {
      toast.error("No valid rows found. Check that required columns are filled in.");
      return;
    }
    setBusy(true);
    try {
      const res = (await onImport(rows)) as any;
      const inserted = (res && res.inserted) ?? rows.length;
      const skipped = (res && res.skipped) ?? 0;
      toast.success(`Imported ${inserted} row${inserted === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
          <p className="font-medium">Required columns:</p>
          <code className="block whitespace-pre-wrap break-all">
            {columns.map((c) => `${c.header}${c.required ? " *" : ""}`).join(",  ")}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-3 w-3 mr-1" /> Download CSV template
          </Button>
        </div>

        <Tabs defaultValue="paste">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">
              <ClipboardPaste className="h-3 w-3 mr-1" /> Paste from Excel
            </TabsTrigger>
            <TabsTrigger value="file">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Upload CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2 mt-3">
            <Label className="text-xs">Copy rows from Excel/Sheets and paste below</Label>
            <Textarea
              rows={8}
              placeholder={`${columns.map((c) => c.header).join("\t")}\n…`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-2 mt-3">
            <Label className="text-xs">Choose a .csv file</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {pasted && (
              <p className="text-xs text-muted-foreground">Preview ({pasted.split(/\r?\n/).filter(Boolean).length} lines loaded)</p>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={() => runImport(pasted)} disabled={!pasted.trim() || busy} className="w-full">
          {busy ? "Importing…" : "Import"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
