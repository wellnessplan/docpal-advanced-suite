import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { Medication } from "./MedicationPanel";

interface PrescriptionDownloadProps {
  patient: any;
  clinic: any;
  doctorName: string;
  doctorRegistration: string;
  doctorDegree: string;
  chiefComplaint: string;
  diagnosisNotes: string;
  treatments: { tooth: number | string; condition: string; treatment: string }[];
  medications: Medication[];
}

type PaperSize = "a5" | "a6" | "letter";

const PAPER_SIZES: Record<PaperSize, { w: number; h: number; label: string }> = {
  a5: { w: 148, h: 210, label: "A5 (148×210mm)" },
  a6: { w: 105, h: 148, label: "A6 (105×148mm)" },
  letter: { w: 216, h: 279, label: "Letter Head" },
};

export default function PrescriptionDownload({
  patient, clinic, doctorName, doctorRegistration, doctorDegree,
  chiefComplaint, diagnosisNotes, treatments, medications,
}: PrescriptionDownloadProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>("a5");

  const buildPDF = () => {
    const ps = PAPER_SIZES[paperSize];
    const doc = new jsPDF({ format: [ps.w, ps.h], unit: "mm" });
    const lm = 8;
    const rm = ps.w - 8;
    const pw = rm - lm;
    let y = 10;
    const lineH = 4;

    // --- HEADER: Clinic name centered ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(clinic?.name || "Dental Clinic", ps.w / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    if (clinic?.address) {
      const addrLines = doc.splitTextToSize(clinic.address, pw - 20);
      addrLines.forEach((line: string) => {
        doc.text(line, ps.w / 2, y, { align: "center" });
        y += 3;
      });
    }
    if (clinic?.phone) {
      doc.text(`Ph: ${clinic.phone}`, ps.w / 2, y, { align: "center" });
      y += 3;
    }
    if (clinic?.email) {
      doc.text(clinic.email, ps.w / 2, y, { align: "center" });
      y += 3;
    }

    // Divider
    y += 1;
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(lm, y, rm, y);
    y += 4;

    // --- PATIENT + DOCTOR ROW ---
    doc.setTextColor(30);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(patient?.full_name || "", lm, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80);

    // Doctor info right
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(doctorName || "Doctor", rm, y, { align: "right" });
    y += 3.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80);
    if (patient?.phone) doc.text(patient.phone, lm, y);
    if (doctorDegree) doc.text(doctorDegree, rm, y, { align: "right" });
    y += 3;
    if (patient?.email) doc.text(patient.email, lm, y);
    if (doctorRegistration) doc.text(`Reg No.: ${doctorRegistration}`, rm, y, { align: "right" });
    y += 4;

    // PRESCRIPTION title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("PRESCRIPTION", ps.w / 2, y, { align: "center" });
    y += 5;

    // Date
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, lm, y);
    y += 5;

    // Chief Complaint
    if (chiefComplaint) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text("Chief Complaint:", lm, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      const lines = doc.splitTextToSize(chiefComplaint, pw);
      lines.forEach((line: string) => {
        if (y > ps.h - 20) { doc.addPage([ps.w, ps.h]); y = 10; }
        doc.text(line, lm, y);
        y += 3;
      });
      y += 2;
    }

    // Brief Treatment Summary (no cost)
    if (treatments.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.setFontSize(7);
      doc.text("Treatment Summary:", lm, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      treatments.forEach((t) => {
        if (y > ps.h - 20) { doc.addPage([ps.w, ps.h]); y = 10; }
        const label = `• Tooth #${t.tooth} — ${t.condition ? t.condition + " → " : ""}${t.treatment || "—"}`;
        const tLines = doc.splitTextToSize(label, pw - 4);
        tLines.forEach((line: string) => {
          doc.text(line, lm + 2, y);
          y += 3;
        });
      });
      y += 2;
    }

    // Diagnosis notes
    if (diagnosisNotes) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.setFontSize(7);
      doc.text("Notes:", lm, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      const lines = doc.splitTextToSize(diagnosisNotes, pw);
      lines.forEach((line: string) => {
        if (y > ps.h - 20) { doc.addPage([ps.w, ps.h]); y = 10; }
        doc.text(line, lm, y);
        y += 3;
      });
      y += 2;
    }

    // Rx Medications
    if (medications.length > 0) {
      y += 1;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text("Rx", lm, y);
      y += 5;

      // Table header
      const colW = [pw * 0.28, pw * 0.14, pw * 0.18, pw * 0.16, pw * 0.24];
      const colX = [lm];
      for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);
      const headers = ["Medicine", "Dosage", "Duration", "Measure", "Instruction"];

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(lm, y - 3, pw, 5, "F");
      headers.forEach((h, i) => doc.text(h, colX[i] + 1, y));
      y += 4;

      doc.setDrawColor(200);
      doc.line(lm, y - 1, rm, y - 1);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);
      medications.forEach((med) => {
        if (y > ps.h - 15) { doc.addPage([ps.w, ps.h]); y = 10; }
        const row = [med.name, med.dosage, med.duration, "", med.frequency];
        row.forEach((val, i) => {
          const cellLines = doc.splitTextToSize(val || "", colW[i] - 2);
          cellLines.forEach((line: string, li: number) => {
            doc.text(line, colX[i] + 1, y + li * 3);
          });
        });
        const maxLines = Math.max(...row.map(v => doc.splitTextToSize(v || "", colW[0]).length));
        y += Math.max(maxLines, 1) * 3 + 1.5;
        doc.setDrawColor(230);
        doc.line(lm, y - 1, rm, y - 1);
      });
      y += 2;
    }

    // Footer: Signature + clinic name
    const footerY = Math.max(y + 10, ps.h - 20);
    if (footerY < ps.h - 5) {
      doc.setDrawColor(30);
      doc.line(rm - 40, footerY, rm, footerY);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text("Doctor's Signature", rm - 20, footerY + 4, { align: "center" });

      doc.setFontSize(6);
      doc.setTextColor(150);
      doc.text(`For ${clinic?.name || "Clinic"}`, ps.w / 2, ps.h - 5, { align: "center" });
    }

    return doc;
  };

  const handleDownload = () => {
    const doc = buildPDF();
    doc.save(`Rx_${patient?.full_name}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Prescription PDF downloaded");
  };

  const handlePrint = () => {
    const doc = buildPDF();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => win.print();
    }
  };

  const handleShare = async () => {
    const doc = buildPDF();
    const blob = doc.output("blob");
    const file = new File([blob], `Rx_${patient?.full_name}.pdf`, { type: "application/pdf" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Prescription", files: [file] });
    } else {
      // Fallback: copy text
      const text = `Prescription for ${patient?.full_name}\nDate: ${new Date().toLocaleDateString()}\n\nChief Complaint: ${chiefComplaint}\n\nMedications:\n${medications.map((m, i) => `${i + 1}. ${m.name} - ${m.dosage} - ${m.frequency} - ${m.duration}`).join("\n")}`;
      await navigator.clipboard.writeText(text);
      toast.success("Prescription text copied to clipboard");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Paper Size</Label>
        <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAPER_SIZES).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5 pt-3">
        <Button size="sm" variant="default" onClick={handleDownload} className="gap-1">
          <Download className="h-3.5 w-3.5" />PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1">
          <Printer className="h-3.5 w-3.5" />Print
        </Button>
        <Button size="sm" variant="outline" onClick={handleShare} className="gap-1">
          <Share2 className="h-3.5 w-3.5" />Share
        </Button>
      </div>
    </div>
  );
}
