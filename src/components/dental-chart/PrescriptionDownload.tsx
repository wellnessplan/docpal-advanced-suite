import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Medication } from "./MedicationPanel";

interface PrescriptionDownloadProps {
  patient: any;
  patientId: string;
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
  patient, patientId, clinic, doctorName, doctorRegistration, doctorDegree,
  chiefComplaint, diagnosisNotes, treatments, medications,
}: PrescriptionDownloadProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>("a5");

  const buildPDF = async () => {
    const ps = PAPER_SIZES[paperSize];
    const doc = new jsPDF({ format: [ps.w, ps.h], unit: "mm" });
    const lm = 10;
    const rm = ps.w - 10;
    const pw = rm - lm;
    let y = 12;

    const checkPage = (needed: number) => {
      if (y + needed > ps.h - 15) { doc.addPage([ps.w, ps.h]); y = 12; }
    };

    // ─── HEADER: Clinic Name ───
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(clinic?.name || "Dental Clinic", ps.w / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (clinic?.address) {
      const addrLines = doc.splitTextToSize(clinic.address, pw - 10);
      addrLines.forEach((line: string) => {
        doc.text(line, ps.w / 2, y, { align: "center" });
        y += 3;
      });
    }
    const contactParts: string[] = [];
    if (clinic?.phone) contactParts.push(`Ph: ${clinic.phone}`);
    if (clinic?.email) contactParts.push(clinic.email);
    if (contactParts.length > 0) {
      doc.text(contactParts.join("  |  "), ps.w / 2, y, { align: "center" });
      y += 3;
    }

    // ─── Divider ───
    y += 1;
    doc.setDrawColor(180);
    doc.setLineWidth(0.4);
    doc.line(lm, y, rm, y);
    y += 5;

    // ─── PATIENT (left) + DOCTOR (right) ───
    const leftX = lm;
    const rightX = rm;
    const infoY = y;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(patient?.full_name || "Patient", leftX, infoY);
    doc.text(doctorName || "Doctor", rightX, infoY, { align: "right" });

    y = infoY + 4;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);

    if (patient?.phone) doc.text(patient.phone, leftX, y);
    if (doctorDegree) doc.text(doctorDegree, rightX, y, { align: "right" });
    y += 3.5;

    if (patient?.email) doc.text(patient.email, leftX, y);
    if (doctorRegistration) doc.text(`Reg: ${doctorRegistration}`, rightX, y, { align: "right" });
    y += 5;

    // ─── PRESCRIPTION Title ───
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("PRESCRIPTION", ps.w / 2, y, { align: "center" });
    y += 6;

    // ─── Date ───
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, leftX, y);
    y += 5;

    // ─── Chief Complaint ───
    if (chiefComplaint) {
      checkPage(12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text("Chief Complaint:", leftX, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      const lines = doc.splitTextToSize(chiefComplaint, pw);
      lines.forEach((line: string) => {
        checkPage(4);
        doc.text(line, leftX, y);
        y += 3.5;
      });
      y += 2;
    }

    // ─── Treatment Summary ───
    if (treatments.length > 0) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.setFontSize(8);
      doc.text("Treatment Summary:", leftX, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(40);
      treatments.forEach((t) => {
        checkPage(6);
        const arrow = t.condition && t.treatment ? " → " : "";
        const label = `•  Tooth #${t.tooth}  —  ${t.condition || ""}${arrow}${t.treatment || "—"}`;
        const tLines = doc.splitTextToSize(label, pw - 6);
        tLines.forEach((line: string) => {
          doc.text(line, leftX + 3, y);
          y += 3.5;
        });
      });
      y += 3;
    }

    // ─── Notes ───
    if (diagnosisNotes) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.setFontSize(8);
      doc.text("Notes:", leftX, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(diagnosisNotes, pw);
      lines.forEach((line: string) => {
        checkPage(4);
        doc.text(line, leftX, y);
        y += 3.5;
      });
      y += 3;
    }

    // ─── Rx Medications ───
    if (medications.length > 0) {
      checkPage(20);
      y += 1;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(14);
      doc.setTextColor(30);
      doc.text("Rx", leftX, y);
      y += 6;

      // Table columns — proportional widths
      const colWidths = [pw * 0.30, pw * 0.13, pw * 0.17, pw * 0.15, pw * 0.25];
      const colX = [leftX];
      for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
      const headers = ["Medicine", "Dosage", "Duration", "Measure", "Instruction"];

      // Header row
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.setFillColor(245, 245, 245);
      doc.rect(leftX, y - 3.5, pw, 6, "F");
      headers.forEach((h, i) => doc.text(h, colX[i] + 1.5, y));
      y += 5;

      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.line(leftX, y - 1.5, rm, y - 1.5);

      // Data rows
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);
      doc.setFontSize(7);
      medications.forEach((med) => {
        checkPage(8);
        const row = [med.name, med.dosage, med.duration, "", med.frequency];
        let maxRowH = 0;
        row.forEach((val, i) => {
          const cellLines = doc.splitTextToSize(val || "", colWidths[i] - 3);
          cellLines.forEach((line: string, li: number) => {
            doc.text(line, colX[i] + 1.5, y + li * 3.2);
          });
          maxRowH = Math.max(maxRowH, cellLines.length * 3.2);
        });
        y += Math.max(maxRowH, 3.2) + 2;
        doc.setDrawColor(230);
        doc.line(leftX, y - 1, rm, y - 1);
      });
      y += 3;
    }

    // ─── QR Code (bottom-left) ───
    const patientUrl = `${window.location.origin}/patients/${patientId}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(patientUrl, { width: 200, margin: 1 });
      const qrSize = paperSize === "a6" ? 18 : 22;
      const qrY = Math.min(y + 4, ps.h - qrSize - 10);
      doc.addImage(qrDataUrl, "PNG", lm, qrY, qrSize, qrSize);
      doc.setFontSize(5);
      doc.setTextColor(140);
      doc.text("Scan for patient details", lm + qrSize / 2, qrY + qrSize + 3, { align: "center" });
    } catch {}

    // ─── Footer: Signature ───
    const sigY = Math.max(y + 12, ps.h - 22);
    if (sigY < ps.h - 8) {
      doc.setDrawColor(60);
      doc.setLineWidth(0.3);
      doc.line(rm - 45, sigY, rm, sigY);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text("Doctor's Signature", rm - 22.5, sigY + 4, { align: "center" });

      doc.setFontSize(6);
      doc.setTextColor(160);
      doc.text(`For ${clinic?.name || "Clinic"}`, ps.w / 2, ps.h - 6, { align: "center" });
    }

    return doc;
  };

  const handleDownload = async () => {
    const doc = await buildPDF();
    doc.save(`Rx_${patient?.full_name}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Prescription PDF downloaded");
  };

  const handlePrint = async () => {
    const doc = await buildPDF();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) { win.onload = () => win.print(); }
  };

  const handleShare = async () => {
    const doc = await buildPDF();
    const blob = doc.output("blob");
    const file = new File([blob], `Rx_${patient?.full_name}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Prescription", files: [file] });
    } else {
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
