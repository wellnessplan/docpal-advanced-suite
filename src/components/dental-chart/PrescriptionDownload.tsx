import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Printer, Share2, Palette } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Medication } from "./MedicationPanel";
import {
  PDF_TEMPLATES, TEMPLATE_LIST, getRxTemplate, setRxTemplate,
  drawTemplateHeader, drawSectionTitle, drawTableHeader, type TemplateId,
} from "@/lib/pdf-templates";

interface PrescriptionDownloadProps {
  patient: any;
  patientId: string;
  clinic: any;
  doctorName: string;
  doctorRegistration: string;
  doctorDegree: string;
  doctorSpecialization?: string;
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
  doctorSpecialization, chiefComplaint, diagnosisNotes, treatments, medications,
}: PrescriptionDownloadProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>("a5");
  const [postInstructions, setPostInstructions] = useState("");

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const buildPDF = async () => {
    const ps = PAPER_SIZES[paperSize];
    const doc = new jsPDF({ format: [ps.w, ps.h], unit: "mm" });
    const lm = 10;
    const rm = ps.w - 10;
    const pw = rm - lm;
    let y = 8;

    const checkPage = (needed: number) => {
      if (y + needed > ps.h - 15) { doc.addPage([ps.w, ps.h]); y = 12; }
    };

    // ─── HEADER BAR ───
    doc.setFillColor(20, 60, 110);
    doc.rect(0, 0, ps.w, paperSize === "a6" ? 28 : 34, "F");

    // Clinic logo
    let logoWidth = 0;
    if (clinic?.logo_url) {
      try {
        const logoBase64 = await loadImageAsBase64(clinic.logo_url);
        if (logoBase64) {
          const logoSize = paperSize === "a6" ? 12 : 16;
          doc.addImage(logoBase64, "PNG", lm, 4, logoSize, logoSize);
          logoWidth = logoSize + 3;
        }
      } catch { /* skip logo */ }
    }

    // Clinic name
    const headerTextX = lm + logoWidth;
    doc.setFontSize(paperSize === "a6" ? 11 : 14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(clinic?.name || "Dental Clinic", headerTextX, paperSize === "a6" ? 12 : 14);

    // Clinic contact info
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    const contactLines: string[] = [];
    if (clinic?.address) contactLines.push(clinic.address);
    const contactParts: string[] = [];
    if (clinic?.phone) contactParts.push(`📞 ${clinic.phone}`);
    if (clinic?.email) contactParts.push(`✉ ${clinic.email}`);
    if (clinic?.website) contactParts.push(`🌐 ${clinic.website}`);
    if (contactParts.length > 0) contactLines.push(contactParts.join("  |  "));

    let contactY = paperSize === "a6" ? 16 : 19;
    contactLines.forEach(line => {
      const wrapped = doc.splitTextToSize(line, pw - logoWidth - 4);
      wrapped.forEach((l: string) => {
        doc.text(l, headerTextX, contactY);
        contactY += 3;
      });
    });

    y = (paperSize === "a6" ? 28 : 34) + 4;

    // ─── PRESCRIPTION TITLE ───
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 60, 110);
    doc.text("PRESCRIPTION", ps.w / 2, y, { align: "center" });
    y += 2;
    doc.setDrawColor(20, 60, 110);
    doc.setLineWidth(0.5);
    const titleW = 32;
    doc.line(ps.w / 2 - titleW / 2, y, ps.w / 2 + titleW / 2, y);
    y += 5;

    // ─── DATE ───
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, rm, y, { align: "right" });
    y += 4;

    // ─── PATIENT (left) + DOCTOR (right) ───
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(lm, y - 3, pw, paperSize === "a6" ? 16 : 20, 2, 2, "F");

    const infoY = y;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(patient?.full_name || "Patient", lm + 3, infoY);
    
    // Doctor details on right
    if (doctorName) {
      doc.text(doctorName, rm - 3, infoY, { align: "right" });
    }

    y = infoY + 4;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);

    // Patient info
    const patientDetails: string[] = [];
    if (patient?.phone) patientDetails.push(patient.phone);
    if (patient?.date_of_birth) patientDetails.push(`DOB: ${patient.date_of_birth}`);
    if (patient?.gender) patientDetails.push(patient.gender);
    if (patientDetails.length > 0) doc.text(patientDetails.join(" | "), lm + 3, y);

    // Doctor qualifications
    const drDetails: string[] = [];
    if (doctorDegree) drDetails.push(doctorDegree);
    if (doctorSpecialization) drDetails.push(doctorSpecialization);
    if (drDetails.length > 0) doc.text(drDetails.join(" | "), rm - 3, y, { align: "right" });
    y += 3.5;

    if (patient?.email) doc.text(patient.email, lm + 3, y);
    if (doctorRegistration) doc.text(`Reg No: ${doctorRegistration}`, rm - 3, y, { align: "right" });

    y += (paperSize === "a6" ? 6 : 8);

    // ─── Chief Complaint ───
    if (chiefComplaint) {
      checkPage(12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 60, 110);
      doc.text("Chief Complaint", lm, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(chiefComplaint, pw);
      lines.forEach((line: string) => { checkPage(4); doc.text(line, lm + 2, y); y += 3.5; });
      y += 2;
    }

    // ─── Treatment Summary ───
    if (treatments.length > 0) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 60, 110);
      doc.setFontSize(8);
      doc.text("Treatment Summary", lm, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(40);
      treatments.forEach((t) => {
        checkPage(6);
        const arrow = t.condition && t.treatment ? " → " : "";
        const label = `•  Tooth #${t.tooth}  —  ${t.condition || ""}${arrow}${t.treatment || "—"}`;
        const tLines = doc.splitTextToSize(label, pw - 6);
        tLines.forEach((line: string) => { doc.text(line, lm + 3, y); y += 3.5; });
      });
      y += 3;
    }

    // ─── Notes ───
    if (diagnosisNotes) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 60, 110);
      doc.setFontSize(8);
      doc.text("Clinical Notes", lm, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(diagnosisNotes, pw);
      lines.forEach((line: string) => { checkPage(4); doc.text(line, lm + 2, y); y += 3.5; });
      y += 3;
    }

    // ─── Rx Medications ───
    if (medications.length > 0) {
      checkPage(20);
      y += 1;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(14);
      doc.setTextColor(20, 60, 110);
      doc.text("Rx", lm, y);
      y += 6;

      const colWidths = [pw * 0.30, pw * 0.13, pw * 0.17, pw * 0.15, pw * 0.25];
      const colX = [lm];
      for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
      const headers = ["Medicine", "Dosage", "Duration", "Measure", "Instruction"];

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255);
      doc.setFillColor(20, 60, 110);
      doc.roundedRect(lm, y - 3.5, pw, 6, 1, 1, "F");
      headers.forEach((h, i) => doc.text(h, colX[i] + 1.5, y));
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);
      doc.setFontSize(7);
      medications.forEach((med, idx) => {
        checkPage(8);
        // Alternate row bg
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 255);
          doc.rect(lm, y - 3, pw, 6, "F");
        }
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
      });
      y += 3;
    }

    // ─── Post-Treatment Instructions ───
    if (postInstructions.trim()) {
      checkPage(14);
      doc.setFillColor(255, 250, 240);
      const instrLines = doc.splitTextToSize(postInstructions.trim(), pw - 8);
      const blockH = Math.max(instrLines.length * 3.5 + 10, 14);
      doc.roundedRect(lm, y - 2, pw, blockH, 2, 2, "F");
      doc.setDrawColor(220, 180, 100);
      doc.setLineWidth(0.3);
      doc.roundedRect(lm, y - 2, pw, blockH, 2, 2, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 120, 20);
      doc.text("⚠ Post-Treatment Instructions", lm + 3, y + 2);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(80, 60, 20);
      instrLines.forEach((line: string) => {
        doc.text(line, lm + 4, y);
        y += 3.5;
      });
      y += 4;
    }

    // ─── QR Code (bottom-left) ───
    const patientUrl = `${window.location.origin}/patients/${patientId}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(patientUrl, { width: 200, margin: 1 });
      const qrSize = paperSize === "a6" ? 16 : 20;
      const qrY = Math.min(y + 4, ps.h - qrSize - 12);
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
      doc.text(doctorName || "Doctor's Signature", rm - 22.5, sigY + 4, { align: "center" });
      if (doctorDegree) {
        doc.setFontSize(6);
        doc.setTextColor(120);
        doc.text(doctorDegree, rm - 22.5, sigY + 7.5, { align: "center" });
      }

      doc.setFontSize(5.5);
      doc.setTextColor(160);
      doc.text(`For ${clinic?.name || "Clinic"}`, ps.w / 2, ps.h - 5, { align: "center" });
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
    <div className="space-y-3">
      {/* Post-Treatment Instructions */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Post-Treatment Instructions (optional)</Label>
        <Textarea
          value={postInstructions}
          onChange={(e) => setPostInstructions(e.target.value)}
          placeholder="e.g. Avoid hot food for 2 hours, take medicines as prescribed, follow up after 7 days..."
          className="min-h-[60px] text-xs"
          rows={3}
        />
      </div>

      {/* Controls */}
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
    </div>
  );
}
